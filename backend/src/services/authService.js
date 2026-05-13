const jwt = require('jsonwebtoken')
const env = require('../config/env')
const db = require('../db/pool')
const { badRequest, unauthorized } = require('../utils/errors')

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
      select u.id, u.openid, s.student_no as "studentNo", s.name, u.role, u.extra_permissions as "extraPermissions"
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
  const userResult = await db.query(
    `
      insert into users (openid, student_id, role)
      values ($1, $2, 'student')
      returning id, openid, role, extra_permissions as "extraPermissions"
    `,
    [openid, student.id]
  )
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

async function findUserByOpenid(openid) {
  const result = await db.query(
    `
      select
        u.id,
        u.openid,
        u.role,
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
  return jwt.sign(
    {
      sub: user.id,
      openid: user.openid,
      studentNo: user.studentNo,
      name: user.name,
      role: user.role,
      permissions: user.extraPermissions || user.permissions || []
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  )
}

module.exports = {
  loginWithWechatCode,
  bindStudent
}
