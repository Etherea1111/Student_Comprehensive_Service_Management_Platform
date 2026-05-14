const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const env = require('../config/env')
const db = require('../db/pool')
const { badRequest, unauthorized, conflict } = require('../utils/errors')
const { hashPassword, verifyPassword, validatePassword, validateStudentNo } = require('../utils/password')

const initialPassword = process.env.INITIAL_STUDENT_PASSWORD || 'RUC@123456'

async function loginWithWechatCode({ code }) {
  if (!code) {
    throw badRequest('code is required')
  }

  const openid = await resolveOpenid(code)
  const user = await findUserByOpenid(openid)
  if (!user) {
    return {
      bindingRequired: true,
      openid,
      token: signToken({
        sub: `pending:${openid}`,
        openid,
        role: 'student',
        permissions: ['read_public']
      })
    }
  }

  return {
    bindingRequired: false,
    token: signToken(user),
    user
  }
}

async function resolveOpenid(code) {
  if (code.startsWith('mock-') || !env.wechatAppId || !env.wechatAppSecret) {
    return code.startsWith('mock-') ? code : `wx_${code}`
  }

  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(env.wechatAppId)}` +
    `&secret=${encodeURIComponent(env.wechatAppSecret)}` +
    `&js_code=${encodeURIComponent(code)}` +
    '&grant_type=authorization_code'
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok || !data.openid) {
    throw unauthorized(data.errmsg || 'wechat login failed')
  }
  return data.openid
}

async function bindStudent({ openid, studentNo, name }) {
  if (!openid || !studentNo || !name) {
    throw badRequest('openid, studentNo and name are required')
  }

  const result = await db.query(
    `
      select
        u.id,
        u.openid,
        s.student_no as "studentNo",
        s.name,
        u.role,
        u.must_change_password as "mustChangePassword",
        u.extra_permissions as "extraPermissions"
      from users u
      join students s on s.id = u.student_id
      where u.openid = $1
    `,
    [openid]
  )
  if (result.rowCount > 0) {
    return {
      token: signToken(result.rows[0]),
      user: result.rows[0]
    }
  }

  const studentResult = await db.query(
    `
      select id, student_no as "studentNo", name
      from students
      where student_no = $1 and name = $2 and deleted_at is null
    `,
    [studentNo, name]
  )
  if (studentResult.rowCount === 0) {
    throw unauthorized('student identity not found')
  }

  const student = studentResult.rows[0]
  const existingAccount = await db.query(
    `
      select id, openid
      from users
      where student_id = $1 and disabled_at is null
      order by id asc
      limit 1
    `,
    [student.id]
  )

  let userResult
  if (existingAccount.rowCount > 0) {
    if (existingAccount.rows[0].openid && existingAccount.rows[0].openid !== openid) {
      throw conflict('student account has already been bound to another WeChat account')
    }
    userResult = await db.query(
      `
        update users
        set openid = $1, updated_at = now()
        where id = $2
        returning id, openid, role, must_change_password as "mustChangePassword", extra_permissions as "extraPermissions"
      `,
      [openid, existingAccount.rows[0].id]
    )
  } else {
    userResult = await db.query(
      `
        insert into users (openid, student_id, role, password_hash, must_change_password)
        values ($1, $2, 'student', $3, true)
        returning id, openid, role, must_change_password as "mustChangePassword", extra_permissions as "extraPermissions"
      `,
      [openid, student.id, hashPassword(initialPassword)]
    )
  }
  const user = {
    ...userResult.rows[0],
    studentNo: student.studentNo,
    name: student.name
  }
  return {
    token: signToken(user),
    user
  }
}

async function loginWithPassword({ studentNo, password }) {
  if (!validateStudentNo(studentNo)) {
    throw badRequest('studentNo must be 10 digits')
  }
  if (!password) {
    throw badRequest('password is required')
  }

  const result = await db.query(
    `
      select
        u.id,
        u.openid,
        u.role,
        u.password_hash as "passwordHash",
        u.must_change_password as "mustChangePassword",
        u.extra_permissions as "extraPermissions",
        s.student_no as "studentNo",
        s.name
      from users u
      join students s on s.id = u.student_id
      where s.student_no = $1 and u.disabled_at is null and s.deleted_at is null
      order by u.id asc
      limit 1
    `,
    [studentNo]
  )
  if (result.rowCount === 0 || !verifyPassword(password, result.rows[0].passwordHash)) {
    throw unauthorized('student number or password is incorrect')
  }

  const user = result.rows[0]
  delete user.passwordHash
  await db.query('update users set last_login_at = now() where id = $1', [user.id])
  return {
    token: signToken(user),
    user,
    mustChangePassword: user.mustChangePassword
  }
}

async function changePassword(user, { oldPassword, newPassword }) {
  if (!oldPassword || !newPassword) {
    throw badRequest('oldPassword and newPassword are required')
  }
  if (!validatePassword(newPassword)) {
    throw badRequest('newPassword must be 8-64 characters')
  }

  const result = await db.query(
    `
      select password_hash as "passwordHash"
      from users
      where id = $1 and disabled_at is null
    `,
    [user.id]
  )
  if (result.rowCount === 0 || !verifyPassword(oldPassword, result.rows[0].passwordHash)) {
    throw unauthorized('old password is incorrect')
  }

  await db.query(
    `
      update users
      set password_hash = $1,
          must_change_password = false,
          password_updated_at = now(),
          updated_at = now()
      where id = $2
    `,
    [hashPassword(newPassword), user.id]
  )

  return { success: true }
}

async function requestPasswordReset({ studentNo, name }) {
  if (!validateStudentNo(studentNo) || !name) {
    throw badRequest('studentNo and name are required')
  }

  const result = await db.query(
    `
      select u.id
      from users u
      join students s on s.id = u.student_id
      where s.student_no = $1 and s.name = $2 and u.disabled_at is null and s.deleted_at is null
      order by u.id asc
      limit 1
    `,
    [studentNo, name]
  )
  if (result.rowCount === 0) {
    throw unauthorized('student identity not found')
  }

  const resetToken = crypto.randomBytes(24).toString('hex')
  await db.query(
    `
      insert into password_reset_requests (user_id, reset_token, status, expires_at)
      values ($1, $2, 'pending', now() + interval '30 minutes')
    `,
    [result.rows[0].id, resetToken]
  )

  return {
    success: true,
    message: 'password reset request submitted',
    resetToken: env.nodeEnv === 'production' ? undefined : resetToken
  }
}

async function resetPassword({ studentNo, resetToken, newPassword }) {
  if (!validateStudentNo(studentNo) || !resetToken || !newPassword) {
    throw badRequest('studentNo, resetToken and newPassword are required')
  }
  if (!validatePassword(newPassword)) {
    throw badRequest('newPassword must be 8-64 characters')
  }

  const result = await db.query(
    `
      select r.id as "requestId", u.id as "userId"
      from password_reset_requests r
      join users u on u.id = r.user_id
      join students s on s.id = u.student_id
      where s.student_no = $1
        and r.reset_token = $2
        and r.status = 'pending'
        and r.expires_at > now()
      order by r.id desc
      limit 1
    `,
    [studentNo, resetToken]
  )
  if (result.rowCount === 0) {
    throw unauthorized('reset token is invalid or expired')
  }

  await db.withTransaction(async (client) => {
    await client.query(
      `
        update users
        set password_hash = $1,
            must_change_password = false,
            password_updated_at = now(),
            updated_at = now()
        where id = $2
      `,
      [hashPassword(newPassword), result.rows[0].userId]
    )
    await client.query(
      `
        update password_reset_requests
        set status = 'used', used_at = now()
        where id = $1
      `,
      [result.rows[0].requestId]
    )
  })

  return { success: true }
}

async function findUserByOpenid(openid) {
  const result = await db.query(
    `
      select
        u.id,
        u.openid,
        u.role,
        u.must_change_password as "mustChangePassword",
        u.extra_permissions as "extraPermissions",
        s.student_no as "studentNo",
        coalesce(s.name, u.display_name) as name
      from users u
      left join students s on s.id = u.student_id
      where u.openid = $1 and u.disabled_at is null
    `,
    [openid]
  )
  return result.rows[0] || null
}

function signToken(user) {
  const subject = user.id || user.sub
  return jwt.sign(
    {
      sub: subject,
      openid: user.openid,
      studentNo: user.studentNo,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      permissions: user.extraPermissions || user.permissions || []
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  )
}

module.exports = {
  loginWithWechatCode,
  bindStudent,
  loginWithPassword,
  changePassword,
  requestPasswordReset,
  resetPassword
}
