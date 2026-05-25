const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
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

router.get(
  '/accounts',
  authenticate,
  requirePermission('manage_accounts'),
  asyncHandler(async (req, res) => {
    res.json({ items: await adminService.listAccounts({ keyword: req.query.keyword, role: req.query.role }) })
  })
)

router.put(
  '/accounts',
  authenticate,
  requirePermission('manage_accounts'),
  audit('upsert_account', 'user'),
  asyncHandler(async (req, res) => {
    res.json(await adminService.upsertAccount(req.body))
  })
)

router.post(
  '/accounts/:id/disable',
  authenticate,
  requirePermission('manage_accounts'),
  audit('disable_account', 'user'),
  asyncHandler(async (req, res) => {
    res.json(await adminService.disableAccount(req.params.id))
  })
)

module.exports = router
