const fs = require('fs')
const path = require('path')
const db = require('../src/db/pool')

const requiredTables = [
  'students',
  'users',
  'knowledge_items',
  'templates',
  'process_stages',
  'process_progress',
  'process_reminder_notifications',
  'quiz_questions',
  'quiz_records',
  'uploaded_files',
  'announcement_tags',
  'announcements',
  'announcement_tag_relations',
  'announcement_targets',
  'announcement_reads',
  'announcement_deliveries',
  'announcement_sources',
  'work_records',
  'approval_requests',
  'approval_attachments',
  'approval_records',
  'operation_logs'
]

const requiredColumns = {
  students: [
    'student_no',
    'phone_encrypted',
    'id_card_encrypted',
    'birthplace_encrypted',
    'household_register_encrypted',
    'advisor_encrypted',
    'student_status_encrypted',
    'remark_encrypted'
  ],
  users: ['account_name', 'password_hash', 'password_change_disabled', 'extra_permissions'],
  process_reminder_notifications: ['process_progress_id', 'next_deadline', 'reminder_date', 'announcement_id'],
  announcements: ['status', 'publish_at', 'expire_at'],
  announcement_deliveries: ['announcement_id', 'user_id', 'channel', 'delivery_status'],
  approval_requests: ['current_step', 'approval_level', 'approved_by', 'college_reviewed_by', 'college_reviewed_at'],
  work_records: ['record_type', 'title', 'record_date', 'attachments']
}

async function runSqlFile(fileName) {
  const sql = fs.readFileSync(path.join(__dirname, '../db', fileName), 'utf8')
  await db.query(sql)
}

async function assertTables() {
  const result = await db.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = current_schema()
        and table_type = 'BASE TABLE'
    `
  )
  const existing = new Set(result.rows.map((row) => row.table_name))
  const missing = requiredTables.filter((tableName) => !existing.has(tableName))
  if (missing.length) {
    throw new Error(`Missing tables: ${missing.join(', ')}`)
  }
  return requiredTables.length
}

async function assertColumns() {
  let checked = 0
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const result = await db.query(
      `
        select column_name
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = $1
      `,
      [tableName]
    )
    const existing = new Set(result.rows.map((row) => row.column_name))
    const missing = columns.filter((column) => !existing.has(column))
    if (missing.length) {
      throw new Error(`Missing columns on ${tableName}: ${missing.join(', ')}`)
    }
    checked += columns.length
  }
  return checked
}

async function assertIndexes() {
  const expectedIndexes = [
    'idx_users_account_name_lower',
    'idx_announcement_deliveries_unique_channel',
    'idx_process_reminder_notifications_progress',
    'idx_approval_requests_status_step'
  ]
  const result = await db.query(
    `
      select indexname
      from pg_indexes
      where schemaname = current_schema()
    `
  )
  const existing = new Set(result.rows.map((row) => row.indexname))
  const missing = expectedIndexes.filter((indexName) => !existing.has(indexName))
  if (missing.length) {
    throw new Error(`Missing indexes: ${missing.join(', ')}`)
  }
  return expectedIndexes.length
}

async function assertSeedData() {
  const checks = [
    ['process_stages', 'select count(*)::int as value from process_stages'],
    ['knowledge_items', 'select count(*)::int as value from knowledge_items'],
    ['quiz_questions', 'select count(*)::int as value from quiz_questions'],
    ['super_admin', "select count(*)::int as value from users where account_name = '2024000001' and role = 'super_admin'"]
  ]
  const values = {}
  for (const [name, sql] of checks) {
    const result = await db.query(sql)
    const value = result.rows[0].value
    values[name] = value
    if (value < 1) {
      throw new Error(`Seed check failed: ${name}`)
    }
  }
  return values
}

async function assertBasicCrud() {
  await db.withTransaction(async (client) => {
    await client.query('create temporary table migration_verify_tmp (id int primary key, name varchar(32)) on commit drop')
    await client.query("insert into migration_verify_tmp (id, name) values (1, 'ok')")
    const result = await client.query('select name from migration_verify_tmp where id = 1')
    if (result.rows[0].name !== 'ok') {
      throw new Error('Temporary CRUD check failed')
    }
  })
}

async function run() {
  console.log('Running database schema and seed scripts...')
  await runSqlFile('schema.sql')
  await runSqlFile('seed.sql')
  console.log('Re-running scripts to verify idempotency...')
  await runSqlFile('schema.sql')
  await runSqlFile('seed.sql')

  const tableCount = await assertTables()
  const columnCount = await assertColumns()
  const indexCount = await assertIndexes()
  const seedValues = await assertSeedData()
  await assertBasicCrud()

  console.log('Database migration verification passed.')
  console.log(
    JSON.stringify(
      {
        tables: tableCount,
        columns: columnCount,
        indexes: indexCount,
        seed: seedValues
      },
      null,
      2
    )
  )
  await db.getPool().end()
}

run().catch(async (error) => {
  console.error('Database migration verification failed.')
  console.error(error)
  try {
    await db.getPool().end()
  } catch (endError) {
    // ignore pool close errors during failed verification
  }
  process.exit(1)
})
