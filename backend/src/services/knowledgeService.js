const db = require('../db/pool')
const { badRequest, notFound } = require('../utils/errors')

const statusTextMap = {
  draft: '待复核',
  published: '已发布',
  rejected: '已退回',
  archived: '已归档'
}

function splitText(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join(',')
  }
  return String(value || '')
}

function mapKnowledgeRow(row) {
  return {
    ...row,
    tags: splitText(row.tagsText),
    keywords: splitText(row.keywordsText),
    statusText: statusTextMap[row.status] || row.status
  }
}

async function searchKnowledge({ keyword, category }) {
  const values = []
  const conditions = ["status = 'published'"]

  if (category && category !== '全部') {
    values.push(category)
    conditions.push(`category = $${values.length}`)
  }

  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(title ilike $${idx} or answer ilike $${idx} or keywords_text ilike $${idx} or tags_text ilike $${idx})`)
  }

  const result = await db.query(
    `
      select
        id,
        title,
        category,
        tags_text as "tagsText",
        answer,
        official_link as "officialLink",
        sensitive_hint as "sensitiveHint",
        owner,
        to_char(updated_at, 'YYYY-MM-DD') as "updatedAt"
      from knowledge_items
      where ${conditions.join(' and ')}
      order by updated_at desc, title asc
    `,
    values
  )
  return result.rows.map(mapKnowledgeRow)
}

async function getCategories() {
  const result = await db.query(
    `
      select distinct category
      from knowledge_items
      where status = 'published'
      order by category
    `
  )
  return ['全部', ...result.rows.map((row) => row.category)]
}

async function createDraft(payload, operator) {
  validateKnowledgePayload(payload)
  const result = await db.query(
    `
      insert into knowledge_items (
        title,
        category,
        tags_text,
        keywords_text,
        answer,
        official_link,
        sensitive_hint,
        owner,
        status,
        created_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
      returning id, title, category, answer, status
    `,
    [
      payload.title,
      payload.category,
      normalizeTextList(payload.tags),
      normalizeTextList(payload.keywords),
      payload.answer,
      payload.officialLink || null,
      payload.sensitiveHint || null,
      payload.owner || operator.name,
      operator.id
    ]
  )
  return result.rows[0]
}

async function listManagedKnowledge({ status, keyword, category } = {}) {
  const values = []
  const conditions = []

  if (status && status !== '全部') {
    values.push(status)
    conditions.push(`status = $${values.length}`)
  }
  if (category && category !== '全部') {
    values.push(category)
    conditions.push(`category = $${values.length}`)
  }
  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(title ilike $${idx} or answer ilike $${idx} or keywords_text ilike $${idx} or tags_text ilike $${idx})`)
  }

  const result = await db.query(
    `
      select
        id,
        title,
        category,
        tags_text as "tagsText",
        keywords_text as "keywordsText",
        answer,
        official_link as "officialLink",
        sensitive_hint as "sensitiveHint",
        owner,
        status,
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt",
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt",
        to_char(reviewed_at, 'YYYY-MM-DD HH24:MI') as "reviewedAt"
      from knowledge_items
      ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
      order by
        case status
          when 'draft' then 1
          when 'rejected' then 2
          when 'published' then 3
          else 4
        end,
        updated_at desc,
        id desc
      limit 100
    `,
    values
  )
  return result.rows.map(mapKnowledgeRow)
}

async function updateKnowledgeItem(id, payload, operator) {
  validateKnowledgePayload(payload)
  const result = await db.query(
    `
      update knowledge_items
      set title = $2,
          category = $3,
          tags_text = $4,
          keywords_text = $5,
          answer = $6,
          official_link = $7,
          sensitive_hint = $8,
          owner = $9,
          status = 'draft',
          reviewed_by = null,
          reviewed_at = null,
          updated_at = now()
      where id = $1
      returning
        id,
        title,
        category,
        tags_text as "tagsText",
        keywords_text as "keywordsText",
        answer,
        official_link as "officialLink",
        sensitive_hint as "sensitiveHint",
        owner,
        status,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
    `,
    [
      id,
      payload.title,
      payload.category,
      normalizeTextList(payload.tags),
      normalizeTextList(payload.keywords),
      payload.answer,
      payload.officialLink || null,
      payload.sensitiveHint || null,
      payload.owner || operator.name
    ]
  )
  if (result.rowCount === 0) {
    throw notFound('knowledge item not found')
  }
  return mapKnowledgeRow(result.rows[0])
}

async function publishDraft(id, operator) {
  const result = await db.query(
    `
      update knowledge_items
      set status = 'published',
          reviewed_by = $2,
          reviewed_at = now(),
          updated_at = now()
      where id = $1
      returning id, title, category, status
    `,
    [id, operator.id]
  )
  if (result.rowCount === 0) {
    throw notFound('knowledge draft not found')
  }
  return result.rows[0]
}

async function rejectDraft(id, operator) {
  const result = await db.query(
    `
      update knowledge_items
      set status = 'rejected',
          reviewed_by = $2,
          reviewed_at = now(),
          updated_at = now()
      where id = $1 and status = 'draft'
      returning id, title, category, status
    `,
    [id, operator.id]
  )
  if (result.rowCount === 0) {
    throw notFound('pending knowledge draft not found')
  }
  return result.rows[0]
}

async function archiveKnowledgeItem(id) {
  const result = await db.query(
    `
      update knowledge_items
      set status = 'archived',
          updated_at = now()
      where id = $1
      returning id, title, category, status
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('knowledge item not found')
  }
  return result.rows[0]
}

function validateKnowledgePayload(payload) {
  if (!payload || !payload.title || !payload.category || !payload.answer) {
    throw badRequest('title, category and answer are required')
  }
}

module.exports = {
  searchKnowledge,
  getCategories,
  createDraft,
  listManagedKnowledge,
  updateKnowledgeItem,
  publishDraft,
  rejectDraft,
  archiveKnowledgeItem
}
