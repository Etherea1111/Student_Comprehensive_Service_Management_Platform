const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const env = require('../config/env')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, optionalAuthenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const knowledgeService = require('../services/knowledgeService')
const { ensureDir, getDownloadName, isSafeStoredPath } = require('../utils/fileStorage')

ensureDir('uploads/knowledge')

const upload = multer({
  dest: 'uploads/knowledge',
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024
  }
})

const router = express.Router()

router.get(
  '/',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const items = await knowledgeService.searchKnowledge({
      keyword: req.query.keyword,
      category: req.query.category
    })
    res.json({ items })
  })
)

router.get(
  '/categories',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    res.json({ categories: await knowledgeService.getCategories() })
  })
)

router.post(
  '/drafts',
  authenticate,
  requirePermission('manage_public_content'),
  audit('create_knowledge_draft', 'knowledge_item'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await knowledgeService.createDraft(req.body, req.user))
  })
)

router.post(
  '/files',
  authenticate,
  requirePermission('manage_public_content'),
  upload.single('file'),
  audit('upload_knowledge_file', 'uploaded_file'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await knowledgeService.uploadKnowledgeFile(req.file, req.user))
  })
)

router.get(
  '/files/:fileId/download',
  authenticate,
  asyncHandler(async (req, res) => {
    const file = await knowledgeService.getKnowledgeFileDownload(req.params.fileId, req.user)
    if (!isSafeStoredPath(file.storagePath, path.resolve('uploads/knowledge')) || !fs.existsSync(file.storagePath)) {
      res.status(404).json({ error: { message: 'file not found' } })
      return
    }
    res.download(file.storagePath, getDownloadName(file.originalName, `knowledge-file-${file.id}`))
  })
)

router.get(
  '/manage',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    const items = await knowledgeService.listManagedKnowledge({
      status: req.query.status,
      keyword: req.query.keyword,
      category: req.query.category
    })
    res.json({ items })
  })
)

router.get(
  '/feedback/manage',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    const items = await knowledgeService.listFeedback({
      status: req.query.status,
      keyword: req.query.keyword
    })
    res.json({ items })
  })
)

router.post(
  '/feedback',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    res.status(201).json(await knowledgeService.submitFeedback(req.body, req.user))
  })
)

router.post(
  '/feedback/:id/handle',
  authenticate,
  requirePermission('manage_public_content'),
  audit('handle_knowledge_feedback', 'knowledge_feedback'),
  asyncHandler(async (req, res) => {
    res.json(await knowledgeService.handleFeedback(req.params.id, req.user))
  })
)

router.get(
  '/:id/versions',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    res.json({ items: await knowledgeService.listVersions(req.params.id) })
  })
)

router.put(
  '/:id',
  authenticate,
  requirePermission('manage_public_content'),
  audit('update_knowledge_item', 'knowledge_item'),
  asyncHandler(async (req, res) => {
    res.json(await knowledgeService.updateKnowledgeItem(req.params.id, req.body, req.user))
  })
)

router.post(
  '/drafts/:id/publish',
  authenticate,
  requirePermission('audit_content'),
  audit('publish_knowledge_draft', 'knowledge_item'),
  asyncHandler(async (req, res) => {
    res.json(await knowledgeService.publishDraft(req.params.id, req.user))
  })
)

router.post(
  '/drafts/:id/reject',
  authenticate,
  requirePermission('audit_content'),
  audit('reject_knowledge_draft', 'knowledge_item'),
  asyncHandler(async (req, res) => {
    res.json(await knowledgeService.rejectDraft(req.params.id, req.user, req.body))
  })
)

router.post(
  '/:id/archive',
  authenticate,
  requirePermission('manage_public_content'),
  audit('archive_knowledge_item', 'knowledge_item'),
  asyncHandler(async (req, res) => {
    res.json(await knowledgeService.archiveKnowledgeItem(req.params.id, req.user))
  })
)

module.exports = router
