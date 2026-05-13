const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate } = require('../middlewares/auth')
const profileService = require('../services/profileService')

const router = express.Router()

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await profileService.getMe(req.user))
  })
)

module.exports = router
