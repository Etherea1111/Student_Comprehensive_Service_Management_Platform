const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, optionalAuthenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const templateService = require('../services/templateService')

const router = express.Router()

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
  '/:id/archive',
  authenticate,
  requirePermission('manage_public_content'),
  audit('archive_template', 'template'),
  asyncHandler(async (req, res) => {
    res.json(await templateService.archiveTemplate(req.params.id))
  })
)

module.exports = router
