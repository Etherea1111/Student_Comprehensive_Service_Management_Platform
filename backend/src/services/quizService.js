const db = require('../db/pool')

async function listPublishedQuestions() {
  const result = await db.query(
    `
      select
        id,
        stem,
        options,
        answer_index as "answerIndex",
        explanation
      from quiz_questions
      where status = 'published'
      order by category asc, id asc
    `
  )
  return result.rows
}

async function gradeQuiz(user, answers) {
  const questions = await listPublishedQuestions()
  const details = questions.map((question, index) => {
    const selectedIndex = answers[index]
    return {
      questionId: question.id,
      selectedIndex,
      correct: selectedIndex === question.answerIndex
    }
  })
  const score = details.filter((item) => item.correct).length

  await db.query(
    `
      insert into quiz_records (user_id, score, total, answers)
      values ($1, $2, $3, $4::jsonb)
    `,
    [user.id, score, questions.length, JSON.stringify(details)]
  )

  return {
    score,
    total: questions.length,
    details
  }
}

async function importQuestions(questions, operator) {
  const inserted = []
  for (const question of questions) {
    const result = await db.query(
      `
        insert into quiz_questions (
          question_code,
          category,
          difficulty,
          stem,
          options,
          answer_index,
          explanation,
          status,
          source,
          created_by
        )
        values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
        on conflict (question_code)
        do update set
          category = excluded.category,
          difficulty = excluded.difficulty,
          stem = excluded.stem,
          options = excluded.options,
          answer_index = excluded.answer_index,
          explanation = excluded.explanation,
          status = excluded.status,
          source = excluded.source,
          updated_at = now()
        returning id, question_code as "questionCode", stem, status
      `,
      [
        question.questionId || null,
        question.category,
        question.difficulty || 'easy',
        question.stem,
        JSON.stringify(question.options),
        question.answerIndex,
        question.explanation || null,
        question.status || 'draft',
        question.source || null,
        operator.id
      ]
    )
    inserted.push(result.rows[0])
  }
  return inserted
}

module.exports = {
  listPublishedQuestions,
  gradeQuiz,
  importQuestions
}
