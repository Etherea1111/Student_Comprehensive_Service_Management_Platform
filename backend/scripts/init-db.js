const fs = require('fs')
const path = require('path')
const db = require('../src/db/pool')

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8')
  const seed = fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8')
  await db.query(schema)
  await db.query(seed)
  console.log('Database initialized.')
  await db.getPool().end()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
