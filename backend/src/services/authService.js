const https = require('https')
const jwt = require('jsonwebtoken')
const env = require('../config/env')
const db = require('../db/pool')
const { badRequest, unauthorized, conflict } = require('../utils/errors')
const {
  hashPassword,
  verifyPassword,
  validatePassword,
  validateStudentNo,
  normalizeAccountName,
  validateAccountName
} = require('../utils/password')


async function loginWithWechat({ code, displayName } = {}) {
  if (!code) {
    throw badRequest('wechat login code is required')
  }
  const session = await exchangeWechatCode(code)
  if (!session.openid) {
    throw unauthorized('wechat openid is not available')
  }

  return db.withTransaction(async (client) => {
    const existingResult = await client.query(
      `
        select
          u.id,
          u.account_name as "accountName",
          u.role,
          u.must_change_password as "mustChangePassword",
          u.password_change_disabled as "passwordChangeDisabled",
          u.extra_permissions as "extraPermissions",
          s.student_no as "studentNo",
          coalesce(s.name, u.display_name) as name
        from users u
        left join students s on s.id = u.student_id and s.deleted_at is null
        where u.wechat_openid = $1
          and u.disabled_at is null
          and (u.student_id is null or s.id is not null)
        limit 1
      `,
      [session.openid]
    )
    if (existingResult.rowCount > 0) {
      const user = existingResult.rows[0]
      await client.query('update users set last_login_at = now() where id = $1', [user.id])
      return {
        token: signToken(user),
        user,
        bindingRequired: user.role === 'student' && !user.studentNo
      }
    }

    const accountName = await buildWechatAccountName(client, session.openid)
    const result = await client.query(
      `
        insert into users (account_name, wechat_openid, display_name, role, must_change_password)
        values ($1, $2, $3, 'student', false)
        returning
          id,
          account_name as "accountName",
          display_name as name,
          role,
          must_change_password as "mustChangePassword",
          password_change_disabled as "passwordChangeDisabled",
          extra_permissions as "extraPermissions"
      `,
      [accountName, session.openid, String(displayName || '').trim() || '????']
    )
    const user = result.rows[0]
    return {
      token: signToken(user),
      user,
      bindingRequired: true
    }
  })
}

async function exchangeWechatCode(code) {
  if (code.startsWith('mock-') || !env.wechatAppId || !env.wechatAppSecret) {
    return { openid: code.startsWith('mock-') ? code : `mock-openid-${code}` }
  }
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(env.wechatAppId)}&secret=${encodeURIComponent(env.wechatAppSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  const data = await getJson(url)
  if (data.errcode) {
    throw unauthorized(`wechat code2Session failed: ${data.errmsg || data.errcode}`)
  }
  return data
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw || '{}'))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })
}

async function buildWechatAccountName(client, openid) {
  const suffix = String(openid).replace(/[^a-zA-Z0-9_]/g, '').slice(-20) || Date.now().toString(36)
  let accountName = `wx_${suffix}`.slice(0, 32)
  let counter = 1
  while (true) {
    const result = await client.query('select 1 from users where lower(account_name) = lower($1) limit 1', [accountName])
    if (result.rowCount === 0) {
      return accountName
    }
    const tail = String(counter).padStart(2, '0')
    accountName = `wx_${suffix}`.slice(0, 32 - tail.length) + tail
    counter += 1
  }
}

async function registerAccount({ accountName, password, displayName }) {
  const normalizedAccountName = normalizeAccountName(accountName)
  if (!validateAccountName(normalizedAccountName)) {
    throw badRequest('accountName must be 4-32 letters, numbers or underscores')
  }
  if (!validatePassword(password)) {
    throw badRequest('password must be 8-64 characters')
  }

  try {
    const result = await db.query(
      `
        insert into users (account_name, display_name, role, password_hash, must_change_password)
        values ($1, $2, 'student', $3, false)
        returning
          id,
          account_name as "accountName",
          display_name as name,
          role,
          must_change_password as "mustChangePassword",
          password_change_disabled as "passwordChangeDisabled",
          extra_permissions as "extraPermissions",
          created_at as "createdAt"
      `,
      [normalizedAccountName, String(displayName || '').trim() || normalizedAccountName, hashPassword(password)]
    )
    const user = result.rows[0]
    return {
      bindingRequired: true,
      token: signToken(user),
      user
    }
  } catch (error) {
    if (error.code === '23505') {
      throw conflict('account name has already been registered')
    }
    throw error
  }
}

async function bindStudent({ userId, studentNo, name }) {
  if (!userId || !studentNo || !name) {
    throw badRequest('studentNo and name are required')
  }
  if (!validateStudentNo(studentNo)) {
    throw badRequest('studentNo must be 10 digits')
  }

  return db.withTransaction(async (client) => {
    const currentResult = await client.query(
      `
        select
          u.id,
          u.account_name as "accountName",
          u.wechat_openid as "wechatOpenid",
          u.student_id as "studentId",
          u.role,
          u.must_change_password as "mustChangePassword",
          u.password_change_disabled as "passwordChangeDisabled",
          u.extra_permissions as "extraPermissions",
          u.created_at as "createdAt",
          s.student_no as "studentNo",
          coalesce(s.name, u.display_name) as name
        from users u
        left join students s on s.id = u.student_id
        where u.id = $1 and u.disabled_at is null
        for update
      `,
      [userId]
    )
    if (currentResult.rowCount === 0) {
      throw unauthorized('account is invalid')
    }
    const currentUser = currentResult.rows[0]

    if (currentUser.studentNo) {
      await client.query('update users set last_login_at = now() where id = $1', [currentUser.id])
      return {
        token: signToken(currentUser),
        user: currentUser,
        bindingRequired: false
      }
    }

    if (currentUser.role !== 'student') {
      await client.query('update users set last_login_at = now() where id = $1', [currentUser.id])
      return {
        token: signToken(currentUser),
        user: currentUser,
        bindingRequired: false
      }
    }

    const studentResult = await client.query(
      `
        select id, student_no as "studentNo", name
        from students
        where student_no = $1 and name = $2 and deleted_at is null
        for update
      `,
      [studentNo, name]
    )
    if (studentResult.rowCount === 0) {
      throw unauthorized('student identity not found')
    }
    const student = studentResult.rows[0]

    const accountResult = await client.query(
      `
        select
          id,
          account_name as "accountName",
          wechat_openid as "wechatOpenid",
          role,
          must_change_password as "mustChangePassword",
          password_change_disabled as "passwordChangeDisabled",
          extra_permissions as "extraPermissions",
          created_at as "createdAt"
        from users
        where disabled_at is null
          and (id = $1 or student_id = $2)
        order by created_at asc, id asc
        for update
      `,
      [currentUser.id, student.id]
    )
    if (accountResult.rowCount === 0) {
      throw unauthorized('account is invalid')
    }

    const primaryAccount = accountResult.rows[0]
    const duplicateAccountIds = accountResult.rows
      .filter((account) => account.id !== primaryAccount.id)
      .map((account) => account.id)
    await retireAccounts(client, duplicateAccountIds)

    if (primaryAccount.id !== currentUser.id) {
      const olderUser = {
        ...primaryAccount,
        studentNo: student.studentNo,
        name: student.name
      }
      await client.query('update users set last_login_at = now() where id = $1', [olderUser.id])
      return {
        token: signToken(olderUser),
        user: olderUser,
        bindingRequired: false,
        mergedToOlderAccount: true
      }
    }

    const userResult = await client.query(
      `
        update users
        set student_id = $1,
            display_name = $2,
            updated_at = now(),
            last_login_at = now()
        where id = $3
        returning
          id,
          account_name as "accountName",
          role,
          must_change_password as "mustChangePassword",
          password_change_disabled as "passwordChangeDisabled",
          extra_permissions as "extraPermissions",
          created_at as "createdAt"
      `,
      [student.id, student.name, currentUser.id]
    )
    const user = {
      ...userResult.rows[0],
      studentNo: student.studentNo,
      name: student.name
    }
    return {
      token: signToken(user),
      user,
      bindingRequired: false
    }
  })
}

async function retireAccounts(client, accountIds) {
  for (const accountId of accountIds) {
    await client.query('SAVEPOINT retire_account')
    try {
      await client.query('delete from users where id = $1', [accountId])
      await client.query('RELEASE SAVEPOINT retire_account')
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT retire_account')
      await client.query('RELEASE SAVEPOINT retire_account')
      await client.query(
        `
          update users
          set account_name = $1,
              student_id = null,
              disabled_at = coalesce(disabled_at, now()),
              updated_at = now()
          where id = $2
        `,
        [`deleted_${accountId}`, accountId]
      )
    }
  }
}

async function loginWithPassword({ accountName, studentNo, password }) {
  const loginName = normalizeAccountName(accountName || studentNo)
  if (!validateAccountName(loginName)) {
    throw badRequest('accountName must be 4-32 letters, numbers or underscores')
  }
  if (!password) {
    throw badRequest('password is required')
  }

  const result = await db.query(
    `
      select
        u.id,
        u.account_name as "accountName",
        u.role,
        u.password_hash as "passwordHash",
        u.must_change_password as "mustChangePassword",
        u.password_change_disabled as "passwordChangeDisabled",
        u.extra_permissions as "extraPermissions",
        s.student_no as "studentNo",
        coalesce(s.name, u.display_name) as name
      from users u
      left join students s on s.id = u.student_id and s.deleted_at is null
      where lower(u.account_name) = $1
        and u.disabled_at is null
        and (u.student_id is null or s.id is not null)
      limit 1
    `,
    [loginName]
  )
  if (result.rowCount === 0 || !verifyPassword(password, result.rows[0].passwordHash)) {
    throw unauthorized('account name or password is incorrect')
  }

  const user = result.rows[0]
  delete user.passwordHash
  await db.query('update users set last_login_at = now() where id = $1', [user.id])
  return {
    token: signToken(user),
    user,
    mustChangePassword: user.mustChangePassword,
    bindingRequired: user.role === 'student' && !user.studentNo
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
      select
        password_hash as "passwordHash",
        password_change_disabled as "passwordChangeDisabled"
      from users
      where id = $1 and disabled_at is null
    `,
    [user.id]
  )
  if (result.rowCount === 0 || !verifyPassword(oldPassword, result.rows[0].passwordHash)) {
    throw unauthorized('old password is incorrect')
  }
  if (result.rows[0].passwordChangeDisabled) {
    throw unauthorized('password change is disabled for this account')
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

function signToken(user) {
  const subject = user.id || user.sub
  return jwt.sign(
    {
      sub: subject,
      accountName: user.accountName,
      wechatOpenid: user.wechatOpenid,
      studentNo: user.studentNo,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      passwordChangeDisabled: user.passwordChangeDisabled,
      permissions: user.extraPermissions || user.permissions || []
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  )
}

module.exports = {
  loginWithWechat,
  registerAccount,
  bindStudent,
  loginWithPassword,
  changePassword
}
