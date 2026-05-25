const db = require('../db/pool')
const env = require('../config/env')
const { badRequest, notFound } = require('../utils/errors')
const { hashPassword, normalizeAccountName, validateAccountName, validatePassword } = require('../utils/password')

async function getDashboard(user) {
  const metrics = await Promise.all([
    countKnowledgeItems(),
    countTemplates(),
    countProcessStages(),
    countDraftKnowledgeItems(),
    countAnnouncements(),
    countPendingApprovals()
  ])
  return {
    user,
    canManage: user.permissions.includes('manage_public_content') || user.permissions.includes('manage_all'),
    metrics: [
      { label: '知识库条目', value: metrics[0] },
      { label: '模板文件', value: metrics[1] },
      { label: '流程配置', value: metrics[2] },
      { label: '待复核内容', value: metrics[3] },
      { label: '公告通知', value: metrics[4] },
      { label: '待审批事项', value: metrics[5] }
    ],
    logs: await getOperationLogs({ limit: 10 })
  }
}

async function countKnowledgeItems() {
  const result = await db.query('select count(*)::int as value from knowledge_items')
  return result.rows[0].value
}

async function countDraftKnowledgeItems() {
  const result = await db.query("select count(*)::int as value from knowledge_items where status = 'draft'")
  return result.rows[0].value
}

async function countTemplates() {
  const result = await db.query('select count(*)::int as value from templates')
  return result.rows[0].value
}

async function countProcessStages() {
  const result = await db.query('select count(*)::int as value from process_stages')
  return result.rows[0].value
}

async function countAnnouncements() {
  const result = await db.query('select count(*)::int as value from announcements')
  return result.rows[0].value
}

async function countPendingApprovals() {
  const result = await db.query("select count(*)::int as value from approval_requests where status = 'pending'")
  return result.rows[0].value
}

async function getOperationLogs({ limit = 50 } = {}) {
  const result = await db.query(
    `
      select
        id,
        operator_name as operator,
        operator_role as role,
        action,
        target_type as "targetType",
        target_id as "targetId",
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
      from operation_logs
      order by created_at desc
      limit $1
    `,
    [Math.min(Number(limit) || 50, 200)]
  )
  return result.rows
}

async function listAccounts({ keyword = '', role = '' } = {}) {
  const values = []
  const conditions = ['u.disabled_at is null']
  if (keyword) {
    values.push(`%${keyword}%`)
    conditions.push(`(u.account_name ilike $${values.length} or u.display_name ilike $${values.length} or s.student_no ilike $${values.length} or s.name ilike $${values.length})`)
  }
  if (role && role !== '全部') {
    values.push(role)
    conditions.push(`u.role = $${values.length}`)
  }
  const result = await db.query(
    `
      select
        u.id,
        u.account_name as "accountName",
        u.display_name as "displayName",
        u.role,
        u.must_change_password as "mustChangePassword",
        u.password_change_disabled as "passwordChangeDisabled",
        u.extra_permissions as "extraPermissions",
        s.student_no as "studentNo",
        s.name as "studentName",
        to_char(u.last_login_at, 'YYYY-MM-DD HH24:MI') as "lastLoginAt",
        to_char(u.updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from users u
      left join students s on s.id = u.student_id
      where ${conditions.join(' and ')}
      order by
        case u.role when 'super_admin' then 1 when 'college_leader' then 2 when 'counselor' then 3 when 'class_leader' then 4 else 5 end,
        u.updated_at desc,
        u.id desc
      limit 200
    `,
    values
  )
  return result.rows.map((row) => ({
    ...row,
    roleText: getRoleText(row.role),
    bindText: row.studentNo ? `${row.studentName} ${row.studentNo}` : '未绑定学生',
    extraPermissionsText: (row.extraPermissions || []).join('、')
  }))
}

async function upsertAccount(payload) {
  if (!payload || !payload.accountName || !payload.role) {
    throw badRequest('accountName and role are required')
  }
  const accountName = normalizeAccountName(payload.accountName)
  if (!validateAccountName(accountName)) {
    throw badRequest('accountName must be 4-32 letters, numbers or underscores')
  }
  const studentId = payload.studentNo ? await getStudentId(payload.studentNo) : null
  const extraPermissions = Array.isArray(payload.extraPermissions)
    ? payload.extraPermissions.map((item) => String(item || '').trim()).filter(Boolean)
    : splitPermissions(payload.extraPermissionsText)

  if (payload.id) {
    const result = await db.query(
      `
        update users
        set account_name = $2,
            display_name = $3,
            role = $4,
            student_id = $5,
            extra_permissions = $6::jsonb,
            password_change_disabled = $7,
            updated_at = now()
        where id = $1 and disabled_at is null
        returning id, account_name as "accountName", display_name as "displayName", role
      `,
      [
        payload.id,
        accountName,
        payload.displayName || accountName,
        payload.role,
        studentId,
        JSON.stringify(extraPermissions),
        payload.passwordChangeDisabled === true
      ]
    )
    if (result.rowCount === 0) {
      throw notFound('account not found')
    }
    return result.rows[0]
  }

  const password = payload.password || '12345678'
  if (!validatePassword(password)) {
    throw badRequest('password must be 8-64 characters')
  }
  const result = await db.query(
    `
      insert into users (
        account_name,
        display_name,
        role,
        student_id,
        password_hash,
        must_change_password,
        password_change_disabled,
        extra_permissions
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      returning id, account_name as "accountName", display_name as "displayName", role
    `,
    [
      accountName,
      payload.displayName || accountName,
      payload.role,
      studentId,
      hashPassword(password),
      payload.mustChangePassword !== false,
      payload.passwordChangeDisabled === true,
      JSON.stringify(extraPermissions)
    ]
  )
  return result.rows[0]
}

async function disableAccount(id) {
  const result = await db.query(
    `
      update users
      set disabled_at = now(),
          updated_at = now()
      where id = $1
      returning id, account_name as "accountName"
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('account not found')
  }
  return result.rows[0]
}

function getUploadPolicy() {
  return {
    allowedTypes: ['doc', 'docx', 'xls', 'xlsx', 'csv', 'pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: env.maxUploadMb,
    auditRequired: true,
    ownerRule: '谁上传，谁维护；敏感资料按角色权限控制。'
  }
}

async function getStudentId(studentNo) {
  const result = await db.query(
    'select id from students where student_no = $1 and deleted_at is null limit 1',
    [studentNo]
  )
  if (result.rowCount === 0) {
    throw notFound('student not found')
  }
  return result.rows[0].id
}

function splitPermissions(value) {
  return String(value || '')
    .split(/[;,，、|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getRoleText(role) {
  const map = {
    student: '普通学生',
    class_leader: '班团骨干',
    counselor: '班主任/辅导员',
    college_leader: '学院领导',
    super_admin: '超级管理员'
  }
  return map[role] || role
}

module.exports = {
  getDashboard,
  getOperationLogs,
  listAccounts,
  upsertAccount,
  disableAccount,
  getUploadPolicy
}
