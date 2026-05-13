const { Pool } = require('pg')
const env = require('../config/env')

let pool = null

function getPool() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000
    })
  }
  return pool
}

async function query(text, params) {
  return getPool().query(text, params)
}

async function withTransaction(handler) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await handler(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  getPool,
  query,
  withTransaction
}
