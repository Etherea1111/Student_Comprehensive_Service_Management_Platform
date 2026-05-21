const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, optionalAuthenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const knowledgeService = require('../services/knowledgeService')

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
    res.json(await knowledgeService.rejectDraft(req.params.id, req.user))
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
