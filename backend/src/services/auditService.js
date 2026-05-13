const db = require('../db/pool')

async function record(entry) {
  if (!entry || !entry.operator) {
    return
  }

  await db.query(
    `
      insert into operation_logs (
        operator_id,
        operator_name,
        operator_role,
        action,
        target_type,
        target_id,
        ip_address,
        device_info
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      entry.operator.id,
      entry.operator.name,
      entry.operator.role,
      entry.action,
      entry.targetType || null,
      entry.targetId || null,
      entry.ipAddress || null,
      entry.deviceInfo || null
    ]
  )
}

module.exports = {
  record
}
