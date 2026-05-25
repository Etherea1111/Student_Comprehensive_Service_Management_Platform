const xlsx = require('xlsx')
const db = require('../db/pool')
const { badRequest } = require('../utils/errors')
const quizService = require('./quizService')
const { encryptField } = require('../utils/cryptoField')
const { hashPassword, validateStudentNo } = require('../utils/password')

const initialPassword = process.env.INITIAL_STUDENT_PASSWORD || 'RUC@123456'

const answerMap = {
  A: 0,
  B: 1,
  C: 2,
  D: 3
}

function readRows(filePath) {
  const workbook = xlsx.readFile(filePath)
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw badRequest('Excel file has no worksheet')
  }
  return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: false
  })
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeProcessType(value) {
  const text = normalizeString(value).toLowerCase()
  const map = {
    party: 'party',
    入党: 'party',
    党建: 'party',
    党员发展: 'party',
    league: 'league',
    入团: 'league',
    团建: 'league',
    团员发展: 'league'
  }
  return map[text] || text
}

function parseDateValue(value, line, field, errors) {
  const text = normalizeString(value)
  if (!text) {
    return null
  }

  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (!match) {
    errors.push({ line, field, message: '日期格式应为 YYYY-MM-DD' })
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    errors.push({ line, field, message: '日期不存在' })
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseListValue(value) {
  const text = normalizeString(value)
  if (!text) {
    return []
  }

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeString(item)).filter(Boolean)
      }
    } catch (error) {
      return []
    }
  }

  return text
    .split(/[;,，、|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseStudents(filePath) {
  const rows = readRows(filePath)
  const validRows = []
  const errors = []
  const seenStudentNos = new Set()

  rows.forEach((row, index) => {
    const line = index + 2
    const item = {
      studentNo: normalizeString(row.student_no),
      name: normalizeString(row.name),
      college: normalizeString(row.college) || '信息学院',
      major: normalizeString(row.major),
      className: normalizeString(row.class_name),
      grade: normalizeString(row.grade),
      educationLevel: normalizeString(row.education_level),
      politicalStatus: normalizeString(row.political_status),
      partyStage: normalizeString(row.party_stage) || 'none',
      leagueStage: normalizeString(row.league_stage) || 'none',
      phone: normalizeString(row.phone),
      idCard: normalizeString(row.id_card),
      birthplace: normalizeString(row.birthplace),
      householdRegister: normalizeString(row.household_register),
      ethnicity: normalizeString(row.ethnicity),
      advisor: normalizeString(row.advisor),
      studentStatus: normalizeString(row.student_status),
      isAlumni: ['是', 'true', 'TRUE', '1'].includes(normalizeString(row.is_alumni)),
      awards: normalizeString(row.awards),
      remark: normalizeString(row.remark)
    }

    if (!item.studentNo) {
      errors.push({ line, field: 'student_no', message: '学号不能为空' })
    }
    if (item.studentNo && !validateStudentNo(item.studentNo)) {
      errors.push({ line, field: 'student_no', message: '学号必须为 10 位数字' })
    }
    if (!item.name) {
      errors.push({ line, field: 'name', message: '姓名不能为空' })
    }
    if (!item.major) {
      errors.push({ line, field: 'major', message: '专业不能为空' })
    }
    if (!item.className) {
      errors.push({ line, field: 'class_name', message: '班级不能为空' })
    }
    if (!item.grade) {
      errors.push({ line, field: 'grade', message: '年级不能为空' })
    }
    if (!item.studentStatus) {
      errors.push({ line, field: 'student_status', message: '学籍状态不能为空' })
    }
    if (seenStudentNos.has(item.studentNo)) {
      errors.push({ line, field: 'student_no', message: '导入文件中学号重复' })
    }
    seenStudentNos.add(item.studentNo)

    if (errors.filter((error) => error.line === line).length === 0) {
      validRows.push({ line, ...item })
    }
  })

  return {
    total: rows.length,
    validRows,
    errors
  }
}

async function importStudents(filePath, operator) {
  const parsed = parseStudents(filePath)
  if (parsed.errors.length > 0) {
    return {
      ...parsed,
      imported: 0
    }
  }

  let imported = 0
  await db.withTransaction(async (client) => {
    for (const item of parsed.validRows) {
      await client.query(
        `
          insert into students (
            student_no,
            name,
            college,
            major,
            class_name,
            grade,
            education_level,
            political_status,
            party_stage,
            league_stage,
            phone_encrypted,
            id_card_encrypted,
            birthplace_encrypted,
            household_register_encrypted,
            ethnicity,
            advisor,
            advisor_encrypted,
            student_status,
            student_status_encrypted,
            is_alumni,
            awards,
            remark,
            remark_encrypted,
            updated_by
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          on conflict (student_no)
          do update set
            name = excluded.name,
            college = excluded.college,
            major = excluded.major,
            class_name = excluded.class_name,
            grade = excluded.grade,
            education_level = excluded.education_level,
            political_status = excluded.political_status,
            party_stage = excluded.party_stage,
            league_stage = excluded.league_stage,
            phone_encrypted = excluded.phone_encrypted,
            id_card_encrypted = excluded.id_card_encrypted,
            birthplace_encrypted = excluded.birthplace_encrypted,
            household_register_encrypted = excluded.household_register_encrypted,
            ethnicity = excluded.ethnicity,
            advisor = excluded.advisor,
            advisor_encrypted = excluded.advisor_encrypted,
            student_status = excluded.student_status,
            student_status_encrypted = excluded.student_status_encrypted,
            is_alumni = excluded.is_alumni,
            awards = excluded.awards,
            remark = excluded.remark,
            remark_encrypted = excluded.remark_encrypted,
            updated_by = excluded.updated_by,
            updated_at = now()
        `,
        [
          item.studentNo,
          item.name,
          item.college,
          item.major,
          item.className,
          item.grade,
          item.educationLevel || null,
          item.politicalStatus || null,
          item.partyStage,
          item.leagueStage,
          encryptField(item.phone),
          encryptField(item.idCard),
          encryptField(item.birthplace),
          encryptField(item.householdRegister),
          item.ethnicity || null,
          item.advisor || null,
          encryptField(item.advisor),
          item.studentStatus || '在读',
          encryptField(item.studentStatus || '在读'),
          item.isAlumni,
          item.awards || null,
          item.remark || null,
          encryptField(item.remark),
          operator.id
        ]
      )
      const studentResult = await client.query('select id from students where student_no = $1', [item.studentNo])
      await client.query(
        `
          insert into users (student_id, display_name, role, password_hash, must_change_password)
          values ($1, $2, 'student', $3, true)
          on conflict (student_id)
          do update set
            display_name = excluded.display_name,
            password_hash = coalesce(users.password_hash, excluded.password_hash),
            must_change_password = case
              when users.password_hash is null then true
              else users.must_change_password
            end,
            updated_at = now()
        `,
        [studentResult.rows[0].id, item.name, hashPassword(initialPassword)]
      )
      await client.query(
        `
          update users
          set account_name = case
                when exists (
                  select 1
                  from users other
                  where lower(other.account_name) = lower($1)
                    and other.id <> users.id
                )
                then users.account_name
                else $1
              end,
              updated_at = now()
          where student_id = $2 and account_name is null
        `,
        [item.studentNo, studentResult.rows[0].id]
      )
      imported += 1
    }
  })

  return {
    ...parsed,
    imported
  }
}

function parseProcessProgress(filePath) {
  const rows = readRows(filePath)
  const validRows = []
  const errors = []
  const seenRows = new Set()

  rows.forEach((row, index) => {
    const line = index + 2
    const processType = normalizeProcessType(row.process_type)
    const item = {
      studentNo: normalizeString(row.student_no),
      name: normalizeString(row.name),
      processType,
      currentStageCode: normalizeString(row.current_stage_code),
      startedAt: parseDateValue(row.started_at, line, 'started_at', errors),
      nextDeadline: parseDateValue(row.next_deadline, line, 'next_deadline', errors),
      advisor: normalizeString(row.advisor),
      completedActions: parseListValue(row.completed_actions),
      remark: normalizeString(row.remark)
    }
    const duplicateKey = `${item.studentNo}:${item.processType}`

    if (!item.studentNo) {
      errors.push({ line, field: 'student_no', message: '学号不能为空' })
    }
    if (item.studentNo && !validateStudentNo(item.studentNo)) {
      errors.push({ line, field: 'student_no', message: '学号必须为 10 位数字' })
    }
    if (!item.name) {
      errors.push({ line, field: 'name', message: '姓名不能为空' })
    }
    if (!['party', 'league'].includes(item.processType)) {
      errors.push({ line, field: 'process_type', message: '流程类型必须为 party/league 或入党/入团' })
    }
    if (!item.currentStageCode) {
      errors.push({ line, field: 'current_stage_code', message: '新进度节点不能为空' })
    }
    if (seenRows.has(duplicateKey)) {
      errors.push({ line, field: 'student_no/process_type', message: '导入文件中同一学生同一流程重复' })
    }
    seenRows.add(duplicateKey)

    if (errors.filter((error) => error.line === line).length === 0) {
      validRows.push({ line, ...item })
    }
  })

  return {
    total: rows.length,
    validRows,
    errors
  }
}

async function validateProcessProgressRows(client, parsed) {
  const errors = [...parsed.errors]

  for (const item of parsed.validRows) {
    const studentResult = await client.query(
      `
        select id
        from students
        where student_no = $1 and name = $2 and deleted_at is null
      `,
      [item.studentNo, item.name]
    )
    if (studentResult.rowCount === 0) {
      errors.push({ line: item.line, field: 'student_no/name', message: '学生不存在或姓名与学号不匹配' })
      continue
    }
    item.studentId = studentResult.rows[0].id

    const stageResult = await client.query(
      `
        select 1
        from process_stages
        where process_type = $1 and stage_code = $2 and enabled = true
      `,
      [item.processType, item.currentStageCode]
    )
    if (stageResult.rowCount === 0) {
      errors.push({ line: item.line, field: 'current_stage_code', message: '流程节点不存在或已停用' })
    }
  }

  return errors
}

async function previewProcessProgress(filePath) {
  const parsed = parseProcessProgress(filePath)
  await db.withTransaction(async (client) => {
    parsed.errors = await validateProcessProgressRows(client, parsed)
  })
  parsed.validRows = parsed.validRows.filter(
    (item) => !parsed.errors.some((error) => error.line === item.line)
  )
  return parsed
}

async function importProcessProgress(filePath, operator) {
  const parsed = parseProcessProgress(filePath)
  await db.withTransaction(async (client) => {
    parsed.errors = await validateProcessProgressRows(client, parsed)
  })
  parsed.validRows = parsed.validRows.filter(
    (item) => !parsed.errors.some((error) => error.line === item.line)
  )
  if (parsed.errors.length > 0) {
    return {
      ...parsed,
      imported: 0
    }
  }

  let imported = 0
  await db.withTransaction(async (client) => {
    for (const item of parsed.validRows) {
      await client.query(
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
            started_at = coalesce(excluded.started_at, process_progress.started_at),
            completed_actions = excluded.completed_actions,
            next_deadline = coalesce(excluded.next_deadline, process_progress.next_deadline),
            advisor = coalesce(excluded.advisor, process_progress.advisor),
            updated_at = now()
        `,
        [
          item.studentId,
          item.processType,
          item.currentStageCode,
          item.startedAt,
          JSON.stringify(item.completedActions),
          item.nextDeadline,
          item.advisor || null
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
        [item.studentId, item.processType, item.currentStageCode, item.advisor || null, operator.id]
      )
      imported += 1
    }
  })

  return {
    ...parsed,
    imported
  }
}

function parseQuizQuestions(filePath) {
  const rows = readRows(filePath)
  const validRows = []
  const errors = []

  rows.forEach((row, index) => {
    const line = index + 2
    const options = [
      normalizeString(row.option_a),
      normalizeString(row.option_b),
      normalizeString(row.option_c),
      normalizeString(row.option_d)
    ].filter(Boolean)
    const answer = normalizeString(row.answer).toUpperCase()
    const answerIndex = answerMap[answer]
    const item = {
      questionId: normalizeString(row.question_id) || null,
      category: normalizeString(row.category),
      difficulty: normalizeString(row.difficulty) || 'easy',
      stem: normalizeString(row.stem),
      options,
      answerIndex,
      explanation: normalizeString(row.explanation),
      status: normalizeString(row.status) || 'draft',
      source: normalizeString(row.source)
    }

    if (!item.category) {
      errors.push({ line, field: 'category', message: '题目分类不能为空' })
    }
    if (!item.stem) {
      errors.push({ line, field: 'stem', message: '题干不能为空' })
    }
    if (options.length < 2) {
      errors.push({ line, field: 'option_a/option_b', message: '至少需要两个选项' })
    }
    if (typeof answerIndex !== 'number' || answerIndex >= options.length) {
      errors.push({ line, field: 'answer', message: '答案必须在已有选项范围内' })
    }

    if (errors.filter((error) => error.line === line).length === 0) {
      validRows.push({ line, ...item })
    }
  })

  return {
    total: rows.length,
    validRows,
    errors
  }
}

async function importQuizQuestions(filePath, operator) {
  const parsed = parseQuizQuestions(filePath)
  if (parsed.errors.length > 0) {
    return {
      ...parsed,
      imported: 0
    }
  }
  const importedRows = await quizService.importQuestions(
    parsed.validRows.map((item, index) => ({
      ...item,
      questionId: item.questionId || `quiz_${Date.now()}_${index}`
    })),
    operator
  )
  return {
    ...parsed,
    imported: importedRows.length,
    importedRows
  }
}

module.exports = {
  parseStudents,
  importStudents,
  parseProcessProgress,
  previewProcessProgress,
  importProcessProgress,
  parseQuizQuestions,
  importQuizQuestions
}
