const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const profileService = require('../services/profileService')

const router = express.Router()

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await profileService.getMe(req.user))
  })
)

router.get(
  '/students',
  authenticate,
  requirePermission('view_operation_records'),
  asyncHandler(async (req, res) => {
    res.json({
      items: await profileService.listManagedStudents(
        {
          keyword: req.query.keyword
        },
        req.user
      )
    })
  })
)

module.exports = router
