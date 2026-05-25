const db = require('../db/pool')
const { badRequest, notFound } = require('../utils/errors')

const allowedRecordTypes = ['party', 'league', 'student_org', 'class_affairs', 'other']
const allowedStatuses = ['draft', 'published', 'archived']

async function listWorkRecords({ keyword = '', recordType = '', status = 'published' } = {}) {
  const values = []
  const conditions = []
  if (recordType && recordType !== '全部') {
    values.push(recordType)
    conditions.push(`record_type = $${values.length}`)
  }
  if (status && status !== '全部') {
    values.push(status)
    conditions.push(`status = $${values.length}`)
  }
  if (keyword) {
    values.push(`%${keyword}%`)
    conditions.push(`(title ilike $${values.length} or organizer ilike $${values.length} or content ilike $${values.length})`)
  }
  const result = await db.query(
    `
      select
        id,
        record_type as "recordType",
        title,
        to_char(occurred_at, 'YYYY-MM-DD') as "occurredAt",
        organizer,
        location,
        participants_count as "participantsCount",
        student_nos as "studentNos",
        content,
        materials_summary as "materialsSummary",
        visibility,
        status,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from work_records
      ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
      order by occurred_at desc, updated_at desc, id desc
      limit 200
    `,
    values
  )
  return result.rows.map(mapWorkRecord)
}

async function upsertWorkRecord(payload, operator) {
  validatePayload(payload)
  const values = [
    payload.recordType,
    payload.title,
    payload.occurredAt,
    payload.organizer || null,
    payload.location || null,
    Number(payload.participantsCount || 0),
    normalizeStudentNos(payload.studentNos),
    payload.content || null,
    payload.materialsSummary || null,
    payload.visibility || 'internal',
    payload.status || 'published',
    operator.id
  ]

  let result
  if (payload.id) {
    result = await db.query(
      `
        update work_records
        set record_type = $2,
            title = $3,
            occurred_at = $4,
            organizer = $5,
            location = $6,
            participants_count = $7,
            student_nos = $8,
            content = $9,
            materials_summary = $10,
            visibility = $11,
            status = $12,
            updated_by = $13,
            updated_at = now()
        where id = $1
        returning *
      `,
      [payload.id, ...values]
    )
  } else {
    result = await db.query(
      `
        insert into work_records (
          record_type,
          title,
          occurred_at,
          organizer,
          location,
          participants_count,
          student_nos,
          content,
          materials_summary,
          visibility,
          status,
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
        returning *
      `,
      values
    )
  }
  if (result.rowCount === 0) {
    throw notFound('work record not found')
  }
  return mapWorkRecord(result.rows[0])
}

async function archiveWorkRecord(id, operator) {
  const result = await db.query(
    `
      update work_records
      set status = 'archived',
          updated_by = $2,
          updated_at = now()
      where id = $1
      returning id, title, status
    `,
    [id, operator.id]
  )
  if (result.rowCount === 0) {
    throw notFound('work record not found')
  }
  return result.rows[0]
}

async function getWorkRecordStats() {
  const result = await db.query(
    `
      select
        record_type as "recordType",
        count(*)::int as count,
        coalesce(sum(participants_count), 0)::int as "participantsCount"
      from work_records
      where status = 'published'
      group by record_type
      order by record_type asc
    `
  )
  return result.rows
}

function validatePayload(payload) {
  if (!payload || !allowedRecordTypes.includes(payload.recordType)) {
    throw badRequest('invalid recordType')
  }
  if (!payload.title || !payload.occurredAt) {
    throw badRequest('title and occurredAt are required')
  }
  if (payload.status && !allowedStatuses.includes(payload.status)) {
    throw badRequest('invalid status')
  }
}

function normalizeStudentNos(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join(',')
  }
  return String(value || '')
}

function mapWorkRecord(row) {
  return {
    ...row,
    studentNoList: String(row.studentNos || '')
      .split(/[;,，、|]/)
      .map((item) => item.trim())
      .filter(Boolean),
    recordTypeText: getRecordTypeText(row.recordType),
    statusText: row.status === 'published' ? '已发布' : row.status === 'archived' ? '已归档' : '草稿'
  }
}

function getRecordTypeText(recordType) {
  const map = {
    party: '党务记录',
    league: '团务记录',
    student_org: '学生组织',
    class_affairs: '班级事务',
    other: '其他'
  }
  return map[recordType] || recordType
}

module.exports = {
  listWorkRecords,
  upsertWorkRecord,
  archiveWorkRecord,
  getWorkRecordStats
}
