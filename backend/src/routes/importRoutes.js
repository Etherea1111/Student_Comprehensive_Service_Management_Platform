const express = require('express')
const multer = require('multer')
const env = require('../config/env')
const asyncHandler = require('../utils/asyncHandler')
const { badRequest } = require('../utils/errors')
const { authenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const importService = require('../services/importService')

const upload = multer({
  dest: 'uploads/tmp',
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024
  }
})

const router = express.Router()

function requireUploadedFile(req) {
  if (!req.file || !req.file.path) {
    throw badRequest('file is required')
  }
}

router.post(
  '/students/preview',
  authenticate,
  requirePermission('import_students'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    requireUploadedFile(req)
    res.json(importService.parseStudents(req.file.path))
  })
)

router.post(
  '/students',
  authenticate,
  requirePermission('import_students'),
  upload.single('file'),
  audit('import_students', 'students'),
  asyncHandler(async (req, res) => {
    requireUploadedFile(req)
    res.json(await importService.importStudents(req.file.path, req.user))
  })
)

router.post(
  '/quiz/preview',
  authenticate,
  requirePermission('import_quiz'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    requireUploadedFile(req)
    res.json(importService.parseQuizQuestions(req.file.path))
  })
)

router.post(
  '/quiz',
  authenticate,
  requirePermission('import_quiz'),
  upload.single('file'),
  audit('import_quiz_questions', 'quiz_questions'),
  asyncHandler(async (req, res) => {
    requireUploadedFile(req)
    res.json(await importService.importQuizQuestions(req.file.path, req.user))
  })
)

module.exports = router
