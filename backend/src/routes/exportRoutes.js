const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const exportService = require('../services/exportService')
const { sendCsv } = require('../utils/exportUtils')

const router = express.Router()

router.get(
  '/students.csv',
  authenticate,
  requirePermission('import_students'),
  audit('export_students', 'students'),
  asyncHandler(async (req, res) => {
    sendCsv(res, 'students_export.csv', await exportService.exportStudents())
  })
)

router.get(
  '/process-progress.csv',
  authenticate,
  requirePermission('manage_process'),
  audit('export_process_progress', 'process_progress'),
  asyncHandler(async (req, res) => {
    sendCsv(res, 'process_progress_export.csv', await exportService.exportProcessProgress())
  })
)

router.get(
  '/knowledge.csv',
  authenticate,
  requirePermission('manage_public_content'),
  audit('export_knowledge', 'knowledge_item'),
  asyncHandler(async (req, res) => {
    sendCsv(res, 'knowledge_items_export.csv', await exportService.exportKnowledge())
  })
)

router.get(
  '/templates.csv',
  authenticate,
  requirePermission('manage_public_content'),
  audit('export_templates', 'template'),
  asyncHandler(async (req, res) => {
    sendCsv(res, 'templates_export.csv', await exportService.exportTemplates())
  })
)

router.get(
  '/approvals.csv',
  authenticate,
  requirePermission('approve_requests'),
  audit('export_approvals', 'approval_request'),
  asyncHandler(async (req, res) => {
    sendCsv(res, 'approvals_export.csv', await exportService.exportApprovals())
  })
)

router.get(
  '/work-records.csv',
  authenticate,
  requirePermission('manage_process'),
  audit('export_work_records', 'work_record'),
  asyncHandler(async (req, res) => {
    sendCsv(res, 'work_records_export.csv', await exportService.exportWorkRecords())
  })
)

router.get(
  '/announcement-deliveries.csv',
  authenticate,
  requirePermission('manage_public_content'),
  audit('export_announcement_deliveries', 'announcement_delivery'),
  asyncHandler(async (req, res) => {
    sendCsv(res, 'announcement_deliveries_export.csv', await exportService.exportDeliveries())
  })
)

module.exports = router
