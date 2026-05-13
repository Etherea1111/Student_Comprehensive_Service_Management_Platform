const { quizQuestions } = require('../data/mockData')
const api = require('./request')

function getQuestions() {
  return quizQuestions
}

function fetchQuestions() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getQuestions())
  }
  return api
    .request({
      url: '/quiz/questions'
    })
    .then((result) => result.items || getQuestions())
    .catch(() => getQuestions())
}

function grade(answers) {
  const details = quizQuestions.map((question, index) => {
    const selectedIndex = answers[index]
    return {
      ...question,
      selectedIndex,
      correct: selectedIndex === question.answerIndex
    }
  })
  const score = details.filter((item) => item.correct).length
  return {
    score,
    total: quizQuestions.length,
    details
  }
}

function submitAnswers(answers) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(grade(answers))
  }
  return api
    .request({
      url: '/quiz/records',
      method: 'POST',
      data: {
        answers
      }
    })
    .catch(() => grade(answers))
}

module.exports = {
  getQuestions,
  fetchQuestions,
  grade,
  submitAnswers
}
