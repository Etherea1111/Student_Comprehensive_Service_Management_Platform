const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { optionalAuthenticate } = require('../middlewares/auth')
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

module.exports = router
