const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const processService = require('../services/processService')

const router = express.Router()

router.get(
  '/:type/me',
  authenticate,
  requirePermission('read_own_progress'),
  asyncHandler(async (req, res) => {
    res.json(await processService.getProcessOverview(req.params.type, req.user))
  })
)

router.get(
  '/stages/manage',
  authenticate,
  requirePermission('manage_process'),
  asyncHandler(async (req, res) => {
    res.json({ items: await processService.listProcessStages(req.query.type) })
  })
)

router.put(
  '/stages',
  authenticate,
  requirePermission('manage_process'),
  audit('upsert_process_stage', 'process_stage'),
  asyncHandler(async (req, res) => {
    res.json(await processService.upsertProcessConfig(req.body, req.user))
  })
)

router.get(
  '/progress/manage',
  authenticate,
  requirePermission('manage_process'),
  asyncHandler(async (req, res) => {
    res.json({
      items: await processService.listProgress({
        keyword: req.query.keyword,
        processType: req.query.processType
      })
    })
  })
)

router.put(
  '/progress',
  authenticate,
  requirePermission('manage_process'),
  audit('upsert_process_progress', 'process_progress'),
  asyncHandler(async (req, res) => {
    res.json(await processService.upsertStudentProgress(req.body, req.user))
  })
)

module.exports = router
