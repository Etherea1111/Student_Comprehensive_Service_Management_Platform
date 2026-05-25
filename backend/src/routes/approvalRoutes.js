const express = require('express')
const multer = require('multer')
const env = require('../config/env')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const approvalService = require('../services/approvalService')

const upload = multer({
  dest: 'uploads/approvals',
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024
  }
})

const router = express.Router()

router.get(
  '/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ items: await approvalService.listMyRequests(req.user) })
  })
)

router.get(
  '/manage',
  authenticate,
  requirePermission('approve_requests'),
  asyncHandler(async (req, res) => {
    res.json({
      items: await approvalService.listPendingRequests(
        {
          status: req.query.status,
          keyword: req.query.keyword
        },
        req.user
      )
    })
  })
)

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await approvalService.getRequestDetail(req.params.id, req.user))
  })
)

router.post(
  '/',
  authenticate,
  audit('upsert_approval_request', 'approval_request'),
  asyncHandler(async (req, res) => {
    const result = await approvalService.saveRequest(req.body, req.user)
    res.status(req.body && req.body.id ? 200 : 201).json(result)
  })
)

router.post(
  '/:id/submit',
  authenticate,
  audit('submit_approval_request', 'approval_request'),
  asyncHandler(async (req, res) => {
    res.json(await approvalService.submitRequest(req.params.id, req.user))
  })
)

router.post(
  '/:id/withdraw',
  authenticate,
  audit('withdraw_approval_request', 'approval_request'),
  asyncHandler(async (req, res) => {
    res.json(await approvalService.withdrawRequest(req.params.id, req.user))
  })
)

router.post(
  '/:id/attachments',
  authenticate,
  upload.single('file'),
  audit('upload_approval_attachment', 'approval_attachment'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await approvalService.addAttachment(req.params.id, req.file, req.user))
  })
)

router.post(
  '/:id/approve',
  authenticate,
  requirePermission('approve_requests'),
  audit('approve_request', 'approval_request'),
  asyncHandler(async (req, res) => {
    res.json(await approvalService.approveRequest(req.params.id, req.body, req.user))
  })
)

router.post(
  '/:id/reject',
  authenticate,
  requirePermission('approve_requests'),
  audit('reject_request', 'approval_request'),
  asyncHandler(async (req, res) => {
    res.json(await approvalService.rejectRequest(req.params.id, req.body, req.user))
  })
)

module.exports = router
