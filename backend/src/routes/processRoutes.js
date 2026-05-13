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

router.put(
  '/stages',
  authenticate,
  requirePermission('manage_process'),
  audit('upsert_process_stage', 'process_stage'),
  asyncHandler(async (req, res) => {
    res.json(await processService.upsertProcessConfig(req.body, req.user))
  })
)

module.exports = router
