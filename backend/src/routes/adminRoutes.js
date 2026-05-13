const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const adminService = require('../services/adminService')

const router = express.Router()

router.get(
  '/dashboard',
  authenticate,
  requirePermission('view_operation_records'),
  asyncHandler(async (req, res) => {
    res.json(await adminService.getDashboard(req.user))
  })
)

router.get(
  '/logs',
  authenticate,
  requirePermission('view_operation_records'),
  asyncHandler(async (req, res) => {
    res.json({ items: await adminService.getOperationLogs(req.query) })
  })
)

router.get(
  '/upload-policy',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    res.json(adminService.getUploadPolicy())
  })
)

module.exports = router
