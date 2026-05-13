const quizService = require('../../services/quizService')

Page({
  data: {
    questions: [],
    answers: [],
    submitted: false,
    result: null
  },

  onLoad() {
    quizService.fetchQuestions().then((questions) => {
      this.rawQuestions = questions
      this.setData({
        questions: this.buildQuestionViewModels(questions, questions.map(() => null), false),
        answers: questions.map(() => null)
      })
    })
  },

  onAnswerChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const value = Number(event.detail.value)
    const answers = this.data.answers.slice()
    answers[index] = value
    this.setData({
      answers,
      questions: this.buildQuestionViewModels(this.rawQuestions || [], answers, this.data.submitted)
    })
  },

  submitQuiz() {
    const unansweredIndex = this.data.answers.findIndex((item) => item === null)
    if (unansweredIndex >= 0) {
      wx.showToast({
        title: `请完成第 ${unansweredIndex + 1} 题`,
        icon: 'none'
      })
      return
    }

    quizService.submitAnswers(this.data.answers).then((result) => {
      this.setData({
        submitted: true,
        result,
        questions: this.buildQuestionViewModels(this.rawQuestions || [], this.data.answers, true)
      })
    })
  },

  resetQuiz() {
    const answers = this.data.questions.map(() => null)
    this.setData({
      answers,
      submitted: false,
      result: null,
      questions: this.buildQuestionViewModels(this.rawQuestions || [], answers, false)
    })
  },

  buildQuestionViewModels(questions, answers, submitted) {
    return questions.map((question, questionIndex) => {
      const selectedValue = answers[questionIndex]
      const correct = selectedValue === question.answerIndex
      return {
        ...question,
        statusText: correct ? '正确' : '需复习',
        statusClass: correct ? 'success' : 'warn',
        correctAnswerText: question.options[question.answerIndex],
        optionItems: question.options.map((label, optionIndex) => ({
          label,
          value: optionIndex,
          checked: selectedValue === optionIndex,
          selectedClass: selectedValue === optionIndex ? 'selected' : ''
        })),
        submitted
      }
    })
  }
})
