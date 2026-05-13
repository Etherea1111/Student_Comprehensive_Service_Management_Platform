const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const quizService = require('../services/quizService')

const router = express.Router()

router.get(
  '/questions',
  authenticate,
  requirePermission('quiz'),
  asyncHandler(async (req, res) => {
    res.json({ items: await quizService.listPublishedQuestions() })
  })
)

router.post(
  '/records',
  authenticate,
  requirePermission('quiz'),
  asyncHandler(async (req, res) => {
    res.json(await quizService.gradeQuiz(req.user, req.body.answers || []))
  })
)

module.exports = router
