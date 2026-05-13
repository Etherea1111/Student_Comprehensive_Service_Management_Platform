const db = require('../db/pool')

async function getProcessOverview(type, user) {
  const stagesResult = await db.query(
    `
      select
        id,
        stage_code as "stageCode",
        name,
        short_name as "shortName",
        description,
        actions,
        reminder_days as "reminderDays",
        sort_order as "sortOrder"
      from process_stages
      where process_type = $1 and enabled = true
      order by sort_order asc
    `,
    [type]
  )

  const progressResult = await db.query(
    `
      select
        pp.current_stage_code as "currentStageId",
        to_char(pp.started_at, 'YYYY-MM-DD') as "startedAt",
        pp.completed_actions as "completedActionIds",
        to_char(pp.next_deadline, 'YYYY-MM-DD') as "nextDeadline",
        pp.advisor
      from process_progress pp
      join users u on u.student_id = pp.student_id
      where u.id = $1 and pp.process_type = $2
    `,
    [user.id, type]
  )

  const stages = stagesResult.rows.map((stage) => ({
    id: stage.stageCode,
    name: stage.name,
    shortName: stage.shortName,
    description: stage.description,
    actions: stage.actions || [],
    reminderDays: stage.reminderDays
  }))
  const progress = progressResult.rows[0] || null
  const currentIndex = progress ? stages.findIndex((stage) => stage.id === progress.currentStageId) : -1
  return {
    type,
    stages,
    progress,
    currentIndex,
    currentStage: currentIndex >= 0 ? stages[currentIndex] : null
  }
}

async function upsertProcessConfig(payload, operator) {
  const result = await db.query(
    `
      insert into process_stages (
        process_type,
        stage_code,
        name,
        short_name,
        description,
        actions,
        reminder_days,
        sort_order,
        updated_by
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      on conflict (process_type, stage_code)
      do update set
        name = excluded.name,
        short_name = excluded.short_name,
        description = excluded.description,
        actions = excluded.actions,
        reminder_days = excluded.reminder_days,
        sort_order = excluded.sort_order,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning id, process_type as "processType", stage_code as "stageCode", name
    `,
    [
      payload.processType,
      payload.stageCode,
      payload.name,
      payload.shortName,
      payload.description,
      JSON.stringify(payload.actions || []),
      payload.reminderDays,
      payload.sortOrder,
      operator.id
    ]
  )
  return result.rows[0]
}

module.exports = {
  getProcessOverview,
  upsertProcessConfig
}
