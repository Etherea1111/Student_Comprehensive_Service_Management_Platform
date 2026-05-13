const db = require('../db/pool')
const env = require('../config/env')

async function getDashboard(user) {
  const metrics = await Promise.all([
    countKnowledgeItems(),
    countTemplates(),
    countProcessStages(),
    countDraftKnowledgeItems()
  ])
  return {
    user,
    canManage: user.permissions.includes('manage_public_content') || user.permissions.includes('manage_all'),
    metrics: [
      { label: '知识库条目', value: metrics[0] },
      { label: '模板文件', value: metrics[1] },
      { label: '流程配置', value: metrics[2] },
      { label: '待复核内容', value: metrics[3] }
    ],
    logs: await getOperationLogs({ limit: 10 })
  }
}

async function countKnowledgeItems() {
  const result = await db.query('select count(*)::int as value from knowledge_items')
  return result.rows[0].value
}

async function countDraftKnowledgeItems() {
  const result = await db.query("select count(*)::int as value from knowledge_items where status = 'draft'")
  return result.rows[0].value
}

async function countTemplates() {
  const result = await db.query('select count(*)::int as value from templates')
  return result.rows[0].value
}

async function countProcessStages() {
  const result = await db.query('select count(*)::int as value from process_stages')
  return result.rows[0].value
}

async function getOperationLogs({ limit = 50 } = {}) {
  const result = await db.query(
    `
      select
        id,
        operator_name as operator,
        operator_role as role,
        action,
        target_type as "targetType",
        target_id as "targetId",
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
      from operation_logs
      order by created_at desc
      limit $1
    `,
    [Math.min(Number(limit) || 50, 200)]
  )
  return result.rows
}

function getUploadPolicy() {
  return {
    allowedTypes: ['doc', 'docx', 'xls', 'xlsx', 'pdf'],
    maxSizeMB: env.maxUploadMb,
    auditRequired: true,
    ownerRule: '谁上传，谁维护；敏感资料按角色权限控制。'
  }
}

module.exports = {
  getDashboard,
  getOperationLogs,
  getUploadPolicy
}
