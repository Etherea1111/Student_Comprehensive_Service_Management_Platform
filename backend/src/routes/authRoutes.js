const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/authService')

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
  asyncHandler(async (req, res) => {
    const result = await authService.bindStudent(req.body)
    res.json(result)
  })
)

module.exports = router
