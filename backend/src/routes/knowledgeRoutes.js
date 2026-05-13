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

router.post(
  '/drafts/:id/publish',
  authenticate,
  requirePermission('audit_content'),
  audit('publish_knowledge_draft', 'knowledge_item'),
  asyncHandler(async (req, res) => {
    res.json(await knowledgeService.publishDraft(req.params.id, req.user))
  })
)

module.exports = router
