const db = require('../db/pool')
const { notFound } = require('../utils/errors')
const { decryptField, maskIdCard, maskPhone } = require('../utils/cryptoField')
const auditService = require('./auditService')

async function getMe(user) {
  const result = await db.query(
    `
      select
        u.id,
        u.account_name as "accountName",
        u.role,
        coalesce(s.student_no, u.account_name) as "studentNo",
        coalesce(s.name, u.display_name) as name,
        coalesce(s.college, '信息学院') as college,
        s.major,
        s.class_name as "className",
        s.grade,
        s.political_status as "politicalStatus",
        s.party_stage as "partyStage",
        s.league_stage as "leagueStage",
        s.student_status as "studentStatus",
        s.is_alumni as "isAlumni",
        s.ethnicity,
        s.advisor,
        u.password_change_disabled as "passwordChangeDisabled"
      from users u
      left join students s on s.id = u.student_id
      where u.id = $1
    `,
    [user.id]
  )

  if (result.rowCount === 0) {
    throw notFound('user not found')
  }

  return {
    ...result.rows[0],
    permissions: user.permissions,
    isAdminAccount: user.role !== 'student' || user.permissions.some((item) => item.startsWith('manage_')),
    canChangePassword: !result.rows[0].passwordChangeDisabled
  }
}

async function listManagedStudents({ keyword = '' } = {}, user) {
  const values = []
  const conditions = ['s.deleted_at is null']
  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(s.student_no ilike $${idx} or s.name ilike $${idx} or s.class_name ilike $${idx} or s.major ilike $${idx})`)
  }

  const result = await db.query(
    `
      select
        s.id,
        s.student_no as "studentNo",
        s.name,
        s.college,
        s.major,
        s.class_name as "className",
        s.grade,
        s.education_level as "educationLevel",
        s.political_status as "politicalStatus",
        s.party_stage as "partyStage",
        s.league_stage as "leagueStage",
        s.phone_encrypted as "phoneEncrypted",
        s.id_card_encrypted as "idCardEncrypted",
        s.birthplace_encrypted as "birthplaceEncrypted",
        s.household_register_encrypted as "householdRegisterEncrypted",
        s.ethnicity,
        s.advisor,
        s.student_status as "studentStatus",
        s.is_alumni as "isAlumni",
        s.awards,
        s.remark,
        u.role,
        u.account_name as "accountName",
        u.extra_permissions as "extraPermissions",
        to_char(s.updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from students s
      left join lateral (
        select role, account_name, extra_permissions
        from users
        where student_id = s.id and disabled_at is null
        order by created_at asc, id asc
        limit 1
      ) u on true
      where ${conditions.join(' and ')}
      order by s.grade desc, s.class_name asc, s.student_no asc
      limit 100
    `,
    values
  )

  const canReadSensitive = user.permissions.includes('read_sensitive') || user.permissions.includes('manage_all')
  if (canReadSensitive) {
    auditService
      .record({
        operator: user,
        action: 'view_sensitive_students',
        targetType: 'student',
        targetId: keyword || 'list',
        afterValue: { keyword, limit: result.rows.length }
      })
      .catch(() => {})
  }
  return result.rows.map((row) => mapStudentRow(row, canReadSensitive))
}

function mapStudentRow(row, canReadSensitive) {
  const phone = decryptField(row.phoneEncrypted)
  const idCard = decryptField(row.idCardEncrypted)
  const birthplace = decryptField(row.birthplaceEncrypted)
  const householdRegister = decryptField(row.householdRegisterEncrypted)
  return {
    id: row.id,
    studentNo: row.studentNo,
    name: row.name,
    college: row.college,
    major: row.major,
    className: row.className,
    grade: row.grade,
    educationLevel: row.educationLevel,
    politicalStatus: row.politicalStatus,
    partyStage: row.partyStage,
    leagueStage: row.leagueStage,
    ethnicity: row.ethnicity,
    advisor: canReadSensitive ? row.advisor : row.advisor ? '已隐藏' : '',
    studentStatus: canReadSensitive ? row.studentStatus : maskStatus(row.studentStatus),
    isAlumni: row.isAlumni,
    awards: row.awards,
    remark: canReadSensitive ? row.remark : row.remark ? '已隐藏' : '',
    role: row.role || 'student',
    accountName: row.accountName,
    extraPermissions: row.extraPermissions || [],
    phone: canReadSensitive ? phone : maskPhone(phone),
    idCard: canReadSensitive ? idCard : maskIdCard(idCard),
    birthplace: canReadSensitive ? birthplace : birthplace ? '已隐藏' : '',
    householdRegister: canReadSensitive ? householdRegister : householdRegister ? '已隐藏' : '',
    sensitiveVisible: canReadSensitive,
    updatedAt: row.updatedAt
  }
}

function maskStatus(status) {
  if (!status || status === '在读') {
    return status || ''
  }
  return '特殊状态已隐藏'
}

module.exports = {
  getMe,
  listManagedStudents
}
