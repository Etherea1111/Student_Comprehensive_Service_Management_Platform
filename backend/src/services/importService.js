const xlsx = require('xlsx')
const db = require('../db/pool')
const { badRequest } = require('../utils/errors')
const quizService = require('./quizService')
const { encryptField } = require('../utils/cryptoField')

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
            student_status,
            is_alumni,
            awards,
            remark,
            updated_by
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
            student_status = excluded.student_status,
            is_alumni = excluded.is_alumni,
            awards = excluded.awards,
            remark = excluded.remark,
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
          item.studentStatus,
          item.isAlumni,
          item.awards || null,
          item.remark || null,
          operator.id
        ]
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
  parseQuizQuestions,
  importQuizQuestions
}
