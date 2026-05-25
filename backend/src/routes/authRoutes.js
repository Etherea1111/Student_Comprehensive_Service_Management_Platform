const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/authService')
const { authenticate } = require('../middlewares/auth')

const router = express.Router()

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const result = await authService.registerAccount(req.body)
    res.json(result)
  })
)

router.post(
  '/password-login',
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithPassword(req.body)
    res.json(result)
  })
)

router.post(
  '/bind-student',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.bindStudent({
      ...req.body,
      userId: req.user.id
    })
    res.json(result)
  })
)

router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user, req.body)
    res.json(result)
  })
)

module.exports = router
