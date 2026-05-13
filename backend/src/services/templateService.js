const db = require('../db/pool')

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

module.exports = {
  listTemplates,
  getCategories
}
