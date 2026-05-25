const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const workRecordService = require('../services/workRecordService')

const router = express.Router()

router.get(
  '/',
  authenticate,
  requirePermission('manage_process'),
  asyncHandler(async (req, res) => {
    res.json({
      items: await workRecordService.listWorkRecords({
        keyword: req.query.keyword,
        recordType: req.query.recordType,
        status: req.query.status || '全部'
      })
    })
  })
)

router.get(
  '/stats',
  authenticate,
  requirePermission('manage_process'),
  asyncHandler(async (req, res) => {
    res.json({ items: await workRecordService.getWorkRecordStats() })
  })
)

router.put(
  '/',
  authenticate,
  requirePermission('manage_process'),
  audit('upsert_work_record', 'work_record'),
  asyncHandler(async (req, res) => {
    res.json(await workRecordService.upsertWorkRecord(req.body, req.user))
  })
)

router.post(
  '/:id/archive',
  authenticate,
  requirePermission('manage_process'),
  audit('archive_work_record', 'work_record'),
  asyncHandler(async (req, res) => {
    res.json(await workRecordService.archiveWorkRecord(req.params.id, req.user))
  })
)

module.exports = router
