const db = require('../db/pool')
const { badRequest, notFound } = require('../utils/errors')

async function listTemplates({ category }) {
  const values = []
  const conditions = ["status = 'published'"]
  if (category && category !== '全部') {
    values.push(category)
    conditions.push(`category = $${values.length}`)
  }
  const result = await db.query(
    `
      select
        id,
        template_name as name,
        upper(file_type) as type,
        category,
        file_size_label as size,
        file_url as url,
        description,
        to_char(updated_at, 'YYYY-MM-DD') as "updatedAt"
      from templates
      where ${conditions.join(' and ')}
      order by updated_at desc, template_name asc
    `,
    values
  )
  return result.rows
}

async function getCategories() {
  const result = await db.query(
    `
      select distinct category
      from templates
      where status = 'published'
      order by category
    `
  )
  return ['全部', ...result.rows.map((row) => row.category)]
}

async function listManagedTemplates({ category, keyword, status } = {}) {
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
    conditions.push(`(template_name ilike $${idx} or description ilike $${idx} or owner ilike $${idx})`)
  }
  const result = await db.query(
    `
      select
        id,
        template_name as name,
        file_type as "fileType",
        upper(file_type) as type,
        category,
        file_size_label as size,
        file_url as url,
        description,
        owner,
        status,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from templates
      ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
      order by
        case status when 'published' then 1 when 'draft' then 2 else 3 end,
        updated_at desc,
        id desc
      limit 100
    `,
    values
  )
  return result.rows.map((item) => ({
    ...item,
    statusText: item.status === 'published' ? '已发布' : item.status === 'archived' ? '已归档' : item.status
  }))
}

async function upsertTemplate(payload, operator) {
  validateTemplatePayload(payload)
  const values = [
    payload.name,
    payload.category,
    String(payload.fileType || '').toLowerCase(),
    payload.size || null,
    payload.url,
    payload.description || null,
    payload.owner || operator.name,
    operator.id
  ]
  const templateValues = values.slice(0, 7)
  let result
  if (payload.id) {
    result = await db.query(
      `
        update templates
        set template_name = $2,
            category = $3,
            file_type = $4,
            file_size_label = $5,
            file_url = $6,
            description = $7,
            owner = $8,
            status = 'published',
            updated_at = now()
        where id = $1
        returning
          id,
          template_name as name,
          category,
          file_type as "fileType",
          file_size_label as size,
          file_url as url,
          description,
          owner,
          status
      `,
      [payload.id, ...templateValues]
    )
  } else {
    result = await db.query(
      `
        insert into templates (
          template_name,
          category,
          file_type,
          file_size_label,
          file_url,
          description,
          owner,
          status,
          created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'published', $8)
        returning
          id,
          template_name as name,
          category,
          file_type as "fileType",
          file_size_label as size,
          file_url as url,
          description,
          owner,
          status
      `,
      values
    )
  }
  if (result.rowCount === 0) {
    throw notFound('template not found')
  }
  return result.rows[0]
}

async function archiveTemplate(id) {
  const result = await db.query(
    `
      update templates
      set status = 'archived',
          updated_at = now()
      where id = $1
      returning id, template_name as name, status
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('template not found')
  }
  return result.rows[0]
}

function validateTemplatePayload(payload) {
  if (!payload || !payload.name || !payload.category || !payload.fileType || !payload.url) {
    throw badRequest('name, category, fileType and url are required')
  }
}

module.exports = {
  listTemplates,
  getCategories,
  listManagedTemplates,
  upsertTemplate,
  archiveTemplate
}
