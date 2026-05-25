const db = require('../db/pool')
const { badRequest, notFound } = require('../utils/errors')

function normalizeProcessType(type) {
  if (type === '入党') {
    return 'party'
  }
  if (type === '入团') {
    return 'league'
  }
  return type
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return String(value || '')
    .split(/[;,，、|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function getProcessOverview(type, user) {
  const processType = normalizeProcessType(type)
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
    [processType]
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
      where u.id = $1 and u.disabled_at is null and pp.process_type = $2
    `,
    [user.id, processType]
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
    type: processType,
    stages,
    progress,
    currentIndex,
    currentStage: currentIndex >= 0 ? stages[currentIndex] : null
  }
}

async function listProcessStages(type) {
  const processType = normalizeProcessType(type)
  const result = await db.query(
    `
      select
        id,
        process_type as "processType",
        stage_code as "stageCode",
        name,
        short_name as "shortName",
        description,
        actions,
        reminder_days as "reminderDays",
        sort_order as "sortOrder",
        enabled,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from process_stages
      where ($1::varchar is null or process_type = $1)
      order by process_type asc, sort_order asc, id asc
    `,
    [processType || null]
  )
  return result.rows
}

async function upsertProcessConfig(payload, operator) {
  if (!payload || !payload.processType || !payload.stageCode || !payload.name) {
    throw badRequest('processType, stageCode and name are required')
  }
  const processType = normalizeProcessType(payload.processType)
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
      returning
        id,
        process_type as "processType",
        stage_code as "stageCode",
        name,
        short_name as "shortName",
        description,
        actions,
        reminder_days as "reminderDays",
        sort_order as "sortOrder",
        enabled
    `,
    [
      processType,
      payload.stageCode,
      payload.name,
      payload.shortName,
      payload.description,
      JSON.stringify(normalizeList(payload.actions)),
      payload.reminderDays,
      payload.sortOrder,
      operator.id
    ]
  )
  return result.rows[0]
}

async function listProgress({ keyword = '', processType = '' } = {}) {
  const values = []
  const conditions = ['s.deleted_at is null']
  const normalizedType = normalizeProcessType(processType)
  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(s.student_no ilike $${idx} or s.name ilike $${idx} or s.class_name ilike $${idx})`)
  }
  if (normalizedType) {
    values.push(normalizedType)
    conditions.push(`pp.process_type = $${values.length}`)
  }

  const result = await db.query(
    `
      select
        s.student_no as "studentNo",
        s.name,
        s.class_name as "className",
        s.grade,
        s.major,
        coalesce(pp.process_type, $${values.length + 1}) as "processType",
        pp.current_stage_code as "currentStageCode",
        ps.name as "currentStageName",
        to_char(pp.started_at, 'YYYY-MM-DD') as "startedAt",
        pp.completed_actions as "completedActions",
        to_char(pp.next_deadline, 'YYYY-MM-DD') as "nextDeadline",
        pp.advisor
      from students s
      left join process_progress pp on pp.student_id = s.id
        ${normalizedType ? '' : "and pp.process_type in ('party', 'league')"}
      left join process_stages ps on ps.process_type = pp.process_type
        and ps.stage_code = pp.current_stage_code
      where ${conditions.join(' and ')}
      order by s.grade desc, s.class_name asc, s.student_no asc, pp.process_type asc
      limit 100
    `,
    [...values, normalizedType || 'party']
  )
  return result.rows.map((row) => ({
    ...row,
    completedActions: row.completedActions || []
  }))
}

async function listDueReminders({ processType = '', days = 7 } = {}) {
  const values = []
  const conditions = [
    's.deleted_at is null',
    'pp.next_deadline is not null',
    `pp.next_deadline <= current_date + ($1::int * interval '1 day')`
  ]
  values.push(Number(days) >= 0 ? Number(days) : 7)
  const normalizedType = normalizeProcessType(processType)
  if (normalizedType) {
    values.push(normalizedType)
    conditions.push(`pp.process_type = $${values.length}`)
  }

  const result = await db.query(
    `
      select
        s.student_no as "studentNo",
        s.name,
        s.class_name as "className",
        s.grade,
        s.major,
        pp.process_type as "processType",
        pp.current_stage_code as "currentStageCode",
        ps.name as "currentStageName",
        to_char(pp.next_deadline, 'YYYY-MM-DD') as "nextDeadline",
        greatest((pp.next_deadline - current_date)::int, 0) as "daysLeft",
        case
          when pp.next_deadline < current_date then 'overdue'
          when pp.next_deadline = current_date then 'today'
          else 'upcoming'
        end as status
      from process_progress pp
      join students s on s.id = pp.student_id
      left join process_stages ps on ps.process_type = pp.process_type
        and ps.stage_code = pp.current_stage_code
      where ${conditions.join(' and ')}
      order by pp.next_deadline asc, s.grade desc, s.class_name asc, s.student_no asc
      limit 200
    `,
    values
  )
  return result.rows
}

async function upsertStudentProgress(payload, operator) {
  if (!payload || !payload.studentNo || !payload.processType || !payload.currentStageCode) {
    throw badRequest('studentNo, processType and currentStageCode are required')
  }
  const processType = normalizeProcessType(payload.processType)
  const completedActions = normalizeList(payload.completedActions)

  const result = await db.withTransaction(async (client) => {
    const studentResult = await client.query(
      `
        select id, name
        from students
        where student_no = $1 and deleted_at is null
      `,
      [payload.studentNo]
    )
    if (studentResult.rowCount === 0) {
      throw notFound('student not found')
    }
    const stageResult = await client.query(
      `
        select stage_code, name
        from process_stages
        where process_type = $1 and stage_code = $2 and enabled = true
      `,
      [processType, payload.currentStageCode]
    )
    if (stageResult.rowCount === 0) {
      throw notFound('process stage not found')
    }

    const progressResult = await client.query(
      `
        insert into process_progress (
          student_id,
          process_type,
          current_stage_code,
          started_at,
          completed_actions,
          next_deadline,
          advisor
        )
        values ($1, $2, $3, $4, $5::jsonb, $6, $7)
        on conflict (student_id, process_type)
        do update set
          current_stage_code = excluded.current_stage_code,
          started_at = excluded.started_at,
          completed_actions = excluded.completed_actions,
          next_deadline = excluded.next_deadline,
          advisor = excluded.advisor,
          updated_at = now()
        returning
          process_type as "processType",
          current_stage_code as "currentStageCode",
          to_char(started_at, 'YYYY-MM-DD') as "startedAt",
          completed_actions as "completedActions",
          to_char(next_deadline, 'YYYY-MM-DD') as "nextDeadline",
          advisor
      `,
      [
        studentResult.rows[0].id,
        processType,
        payload.currentStageCode,
        payload.startedAt || null,
        JSON.stringify(completedActions),
        payload.nextDeadline || null,
        payload.advisor || null
      ]
    )

    await client.query(
      `
        update students
        set party_stage = case when $2 = 'party' then $3 else party_stage end,
            league_stage = case when $2 = 'league' then $3 else league_stage end,
            advisor = coalesce($4, advisor),
            updated_by = $5,
            updated_at = now()
        where id = $1
      `,
      [studentResult.rows[0].id, processType, payload.currentStageCode, payload.advisor || null, operator.id]
    )

    return {
      studentNo: payload.studentNo,
      name: studentResult.rows[0].name,
      currentStageName: stageResult.rows[0].name,
      ...progressResult.rows[0]
    }
  })

  return {
    ...result,
    completedActions: result.completedActions || []
  }
}

module.exports = {
  getProcessOverview,
  listProcessStages,
  upsertProcessConfig,
  listProgress,
  listDueReminders,
  upsertStudentProgress
}
