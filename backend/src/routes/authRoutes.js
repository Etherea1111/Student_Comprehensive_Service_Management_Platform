const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/authService')
const { authenticate } = require('../middlewares/auth')

const router = express.Router()

router.post(
  '/wechat-login',
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithWechatCode(req.body)
    res.json(result)
  })
)

router.post(
  '/bind-student',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.bindStudent({
      ...req.body,
      openid: req.user.openid
    })
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
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user, req.body)
    res.json(result)
  })
)

router.post(
  '/password-reset/request',
  asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body)
    res.json(result)
  })
)

router.post(
  '/password-reset/confirm',
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body)
    res.json(result)
  })
)

module.exports = router
