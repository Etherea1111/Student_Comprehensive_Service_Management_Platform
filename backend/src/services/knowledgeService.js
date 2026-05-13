const db = require('../db/pool')

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
        string_to_array(coalesce(tags_text, ''), ',') as tags,
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
  return result.rows.map((item) => ({
    ...item,
    tags: (item.tags || []).filter(Boolean)
  }))
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
      (payload.tags || []).join(','),
      (payload.keywords || []).join(','),
      payload.answer,
      payload.officialLink || null,
      payload.sensitiveHint || null,
      payload.owner || operator.name,
      operator.id
    ]
  )
  return result.rows[0]
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
  return result.rows[0]
}

module.exports = {
  searchKnowledge,
  getCategories,
  createDraft,
  publishDraft
}
