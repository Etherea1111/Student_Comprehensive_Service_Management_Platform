const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { authenticate, requirePermission } = require('../middlewares/auth')
const audit = require('../middlewares/audit')
const announcementService = require('../services/announcementService')

const router = express.Router()

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await announcementService.listPublishedAnnouncements({
      user: req.user,
      tag: req.query.tag,
      keyword: req.query.keyword,
      unreadOnly: req.query.unreadOnly
    })
    res.json({ items })
  })
)

router.get(
  '/tags',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ tags: await announcementService.listTags() })
  })
)

router.get(
  '/manage',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    const items = await announcementService.listManagedAnnouncements({
      status: req.query.status,
      keyword: req.query.keyword
    })
    res.json({ items })
  })
)

router.post(
  '/manage',
  authenticate,
  requirePermission('manage_public_content'),
  audit('upsert_announcement', 'announcement'),
  asyncHandler(async (req, res) => {
    const result = await announcementService.upsertAnnouncement(req.body, req.user)
    res.status(req.body && req.body.id ? 200 : 201).json(result)
  })
)

router.get(
  '/manage/tags',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    res.json({ tags: await announcementService.listTags({ includeDisabled: true }) })
  })
)

router.get(
  '/manage/sources',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    res.json({ items: await announcementService.listSources({ keyword: req.query.keyword }) })
  })
)

router.post(
  '/manage/sources',
  authenticate,
  requirePermission('manage_public_content'),
  audit('upsert_announcement_source', 'announcement_source'),
  asyncHandler(async (req, res) => {
    const result = await announcementService.upsertSource(req.body, req.user)
    res.status(req.body && req.body.id ? 200 : 201).json(result)
  })
)

router.post(
  '/manage/sources/:id/import',
  authenticate,
  requirePermission('manage_public_content'),
  audit('import_announcement_source', 'announcement_source'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await announcementService.importFromSource(req.params.id, req.user))
  })
)

router.post(
  '/manage/tags',
  authenticate,
  requirePermission('manage_public_content'),
  audit('upsert_announcement_tag', 'announcement_tag'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await announcementService.upsertTag(req.body, req.user))
  })
)

router.post(
  '/:id/read',
  authenticate,
  audit('read_announcement', 'announcement'),
  asyncHandler(async (req, res) => {
    res.json(await announcementService.markAsRead(req.params.id, req.user))
  })
)

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await announcementService.getAnnouncementDetail(req.params.id, req.user))
  })
)

router.post(
  '/:id/publish',
  authenticate,
  requirePermission('manage_public_content'),
  audit('publish_announcement', 'announcement'),
  asyncHandler(async (req, res) => {
    res.json(await announcementService.publishAnnouncement(req.params.id, req.user))
  })
)

router.post(
  '/:id/dispatch',
  authenticate,
  requirePermission('manage_public_content'),
  audit('dispatch_announcement', 'announcement_delivery'),
  asyncHandler(async (req, res) => {
    res.json(await announcementService.dispatchAnnouncement(req.params.id, req.body))
  })
)

router.get(
  '/:id/deliveries',
  authenticate,
  requirePermission('manage_public_content'),
  asyncHandler(async (req, res) => {
    res.json({ items: await announcementService.listDeliveries(req.params.id) })
  })
)

router.post(
  '/:id/withdraw',
  authenticate,
  requirePermission('manage_public_content'),
  audit('withdraw_announcement', 'announcement'),
  asyncHandler(async (req, res) => {
    res.json(await announcementService.withdrawAnnouncement(req.params.id))
  })
)

router.post(
  '/:id/archive',
  authenticate,
  requirePermission('manage_public_content'),
  audit('archive_announcement', 'announcement'),
  asyncHandler(async (req, res) => {
    res.json(await announcementService.archiveAnnouncement(req.params.id))
  })
)

module.exports = router
