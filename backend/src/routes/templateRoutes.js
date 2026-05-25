const express = require('express')
const multer = require('multer')
const env = require('../config/env')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, optionalAuthenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const templateService = require('../services/templateService')
const { ensureDir } = require('../utils/fileStorage')

const router = express.Router()

ensureDir('uploads/knowledge')

const upload = multer({
  dest: 'uploads/knowledge',
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024
  }
})

router.get(
  '/',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const items = await templateService.listTemplates({ category: req.query.category })
    res.json({ items })
  })
)

router.get(
  '/categories',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    res.json({ categories: await templateService.getCategories() })
  })
)

router.get(
  '/manage',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    res.json({
      items: await templateService.listManagedTemplates({
        category: req.query.category,
        keyword: req.query.keyword,
        status: req.query.status
      })
    })
  })
)

router.put(
  '/',
  authenticate,
  requirePermission('manage_public_content'),
  audit('upsert_template', 'template'),
  asyncHandler(async (req, res) => {
    res.json(await templateService.upsertTemplate(req.body, req.user))
  })
)

router.post(
  '/files',
  authenticate,
  requirePermission('manage_public_content'),
  upload.single('file'),
  audit('upload_template_file', 'uploaded_file'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await templateService.uploadTemplateFile(req.file, req.user))
  })
)

router.post(
  '/:id/archive',
  authenticate,
  requirePermission('manage_public_content'),
  audit('archive_template', 'template'),
  asyncHandler(async (req, res) => {
    res.json(await templateService.archiveTemplate(req.params.id))
  })
)

module.exports = router
