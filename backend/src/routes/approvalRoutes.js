const express = require('express')
const multer = require('multer')
const env = require('../config/env')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requireAnyPermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const approvalService = require('../services/approvalService')
const { ensureDir, getDownloadName } = require('../utils/fileStorage')
const { sendTextAsPdf } = require('../utils/exportUtils')

ensureDir('uploads/approvals')

const upload = multer({
  dest: 'uploads/approvals',
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024
  }
})

const router = express.Router()

router.get(
  '/attachments/:attachmentId/download',
  authenticate,
  asyncHandler(async (req, res) => {
    const attachment = await approvalService.getAttachmentDownload(req.params.attachmentId, req.user)
    res.download(attachment.storagePath, getDownloadName(attachment.originalName, `attachment-${attachment.id}`))
  })
)

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
  requireAnyPermission(['approve_requests', 'approve_college_review']),
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

router.get(
  '/:id/proof.pdf',
  authenticate,
  asyncHandler(async (req, res) => {
    const proof = await approvalService.getGeneratedProof(req.params.id, req.user, 'pdf')
    sendTextAsPdf(res, proof.filename, proof.title, proof.content)
  })
)

router.get(
  '/:id/proof.txt',
  authenticate,
  asyncHandler(async (req, res) => {
    const proof = await approvalService.getGeneratedProof(req.params.id, req.user, 'txt')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${proof.filename}"`)
    res.send(proof.content)
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
  requireAnyPermission(['approve_requests', 'approve_college_review']),
  audit('approve_request', 'approval_request'),
  asyncHandler(async (req, res) => {
    res.json(await approvalService.approveRequest(req.params.id, req.body, req.user))
  })
)

router.post(
  '/:id/reject',
  authenticate,
  requireAnyPermission(['approve_requests', 'approve_college_review']),
  audit('reject_request', 'approval_request'),
  asyncHandler(async (req, res) => {
    res.json(await approvalService.rejectRequest(req.params.id, req.body, req.user))
  })
)

module.exports = router
