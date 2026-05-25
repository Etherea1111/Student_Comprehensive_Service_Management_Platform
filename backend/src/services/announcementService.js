const db = require('../db/pool')
const { badRequest, notFound } = require('../utils/errors')
const notificationProvider = require('./notificationProvider')

const allowedPriorities = ['low', 'normal', 'high', 'urgent']
const allowedStatuses = ['draft', 'published', 'withdrawn', 'archived']
const allowedTargetTypes = [
  'all',
  'role',
  'grade',
  'major',
  'class_name',
  'education_level',
  'student_no',
  'student_status',
  'is_alumni'
]

function mapAnnouncementRow(row) {
  return {
    ...row,
    tags: parseJsonArray(row.tags),
    targets: parseJsonArray(row.targets),
    isRead: Boolean(row.isRead),
    readCount: Number(row.readCount || 0)
  }
}

function parseJsonArray(value) {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  try {
    return JSON.parse(value)
  } catch (error) {
    return []
  }
}

async function listPublishedAnnouncements({ user, tag, keyword, unreadOnly } = {}) {
  const values = [user.id]
  const conditions = [
    "a.status = 'published'",
    '(a.publish_at is null or a.publish_at <= now())',
    '(a.expire_at is null or a.expire_at > now())'
  ]

  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(a.title ilike $${idx} or a.summary ilike $${idx} or a.content ilike $${idx} or a.source_name ilike $${idx})`)
  }

  if (tag && tag !== '全部') {
    values.push(tag)
    conditions.push(`exists (
      select 1
      from announcement_tag_relations atr
      join announcement_tags at on at.id = atr.tag_id
      where atr.announcement_id = a.id and at.tag_name = $${values.length}
    )`)
  }

  if (String(unreadOnly) === 'true') {
    conditions.push('ar.user_id is null')
  }

  conditions.push(buildAudienceCondition(values, user))

  const result = await db.query(
    `
      select
        a.id,
        a.title,
        a.summary,
        a.content,
        a.source_name as "sourceName",
        a.source_url as "sourceUrl",
        a.priority,
        to_char(a.publish_at, 'YYYY-MM-DD HH24:MI') as "publishAt",
        to_char(a.expire_at, 'YYYY-MM-DD HH24:MI') as "expireAt",
        ar.user_id is not null as "isRead",
        coalesce(tags.items, '[]') as tags
      from announcements a
      left join announcement_reads ar on ar.announcement_id = a.id and ar.user_id = $1
      left join lateral (
        select json_agg(at.tag_name order by at.tag_name) as items
        from announcement_tag_relations atr
        join announcement_tags at on at.id = atr.tag_id
        where atr.announcement_id = a.id and at.enabled = true
      ) tags on true
      where ${conditions.join(' and ')}
      order by
        case a.priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
        a.publish_at desc nulls last,
        a.id desc
      limit 100
    `,
    values
  )
  return result.rows.map(mapAnnouncementRow)
}

function buildAudienceCondition(values, user) {
  const audienceParts = ['not exists (select 1 from announcement_targets atg where atg.announcement_id = a.id)']
  audienceParts.push("exists (select 1 from announcement_targets atg where atg.announcement_id = a.id and atg.target_type = 'all')")

  values.push(user.role || 'student')
  audienceParts.push(`exists (select 1 from announcement_targets atg where atg.announcement_id = a.id and atg.target_type = 'role' and atg.target_value = $${values.length})`)

  if (user.studentNo) {
    values.push(user.studentNo)
    audienceParts.push(`exists (select 1 from announcement_targets atg where atg.announcement_id = a.id and atg.target_type = 'student_no' and atg.target_value = $${values.length})`)
  }

  const profileTargetTypes = ['grade', 'major', 'class_name', 'education_level']
  for (const targetType of profileTargetTypes) {
    audienceParts.push(`exists (
      select 1
      from announcement_targets atg
      join users u on u.id = $1
      join students s on s.id = u.student_id
      where atg.announcement_id = a.id
        and atg.target_type = '${targetType}'
        and atg.target_value = s.${targetType}
    )`)
  }

  audienceParts.push(`exists (
    select 1
    from announcement_targets atg
    join users u on u.id = $1
    join students s on s.id = u.student_id
    where atg.announcement_id = a.id
      and atg.target_type = 'student_status'
      and atg.target_value = s.student_status
  )`)
  audienceParts.push(`exists (
    select 1
    from announcement_targets atg
    join users u on u.id = $1
    join students s on s.id = u.student_id
    where atg.announcement_id = a.id
      and atg.target_type = 'is_alumni'
      and atg.target_value = case when s.is_alumni then 'true' else 'false' end
  )`)

  return `(${audienceParts.join(' or ')})`
}

async function getAnnouncementDetail(id, user) {
  const items = await listPublishedAnnouncements({ user })
  const item = items.find((announcement) => Number(announcement.id) === Number(id))
  if (!item) {
    throw notFound('announcement not found')
  }
  return item
}

async function markAsRead(id, user) {
  await getAnnouncementDetail(id, user)
  const result = await db.query(
    `
      insert into announcement_reads (announcement_id, user_id)
      values ($1, $2)
      on conflict (announcement_id, user_id)
      do update set read_at = excluded.read_at
      returning announcement_id as "announcementId", user_id as "userId", to_char(read_at, 'YYYY-MM-DD HH24:MI') as "readAt"
    `,
    [id, user.id]
  )
  return result.rows[0]
}

async function listTags({ includeDisabled = false } = {}) {
  const result = await db.query(
    `
      select id, tag_name as name, description, enabled
      from announcement_tags
      ${includeDisabled ? '' : 'where enabled = true'}
      order by tag_name asc
    `
  )
  return includeDisabled ? result.rows : [{ id: 0, name: '全部', description: null, enabled: true }, ...result.rows]
}

async function listManagedAnnouncements({ status, keyword } = {}) {
  const values = []
  const conditions = []
  if (status && status !== '全部') {
    values.push(status)
    conditions.push(`a.status = $${values.length}`)
  }
  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(a.title ilike $${idx} or a.summary ilike $${idx} or a.content ilike $${idx} or a.source_name ilike $${idx})`)
  }
  const result = await db.query(
    `
      select
        a.id,
        a.title,
        a.summary,
        a.content,
        a.source_name as "sourceName",
        a.source_url as "sourceUrl",
        a.priority,
        a.status,
        to_char(a.publish_at, 'YYYY-MM-DD HH24:MI') as "publishAt",
        to_char(a.expire_at, 'YYYY-MM-DD HH24:MI') as "expireAt",
        to_char(a.updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt",
        coalesce(tags.items, '[]') as tags,
        coalesce(targets.items, '[]') as targets,
        coalesce(reads.value, 0) as "readCount"
      from announcements a
      left join lateral (
        select json_agg(at.tag_name order by at.tag_name) as items
        from announcement_tag_relations atr
        join announcement_tags at on at.id = atr.tag_id
        where atr.announcement_id = a.id
      ) tags on true
      left join lateral (
        select json_agg(json_build_object('type', target_type, 'value', target_value) order by target_type, target_value) as items
        from announcement_targets atg
        where atg.announcement_id = a.id
      ) targets on true
      left join lateral (
        select count(*)::int as value
        from announcement_reads ar
        where ar.announcement_id = a.id
      ) reads on true
      ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
      order by a.updated_at desc, a.id desc
      limit 100
    `,
    values
  )
  return result.rows.map(mapAnnouncementRow)
}

async function upsertAnnouncement(payload, operator) {
  validateAnnouncementPayload(payload)
  return db.withTransaction(async (client) => {
    const values = [
      payload.title,
      payload.summary || null,
      payload.content,
      payload.sourceName || null,
      payload.sourceUrl || null,
      payload.priority || 'normal',
      payload.status || 'draft',
      payload.publishAt || null,
      payload.expireAt || null,
      operator.id
    ]
    let result
    if (payload.id) {
      result = await client.query(
        `
          update announcements
          set title = $2,
              summary = $3,
              content = $4,
              source_name = $5,
              source_url = $6,
              priority = $7,
              status = $8,
              publish_at = $9,
              expire_at = $10,
              updated_at = now()
          where id = $1
          returning id
        `,
        [payload.id, ...values.slice(0, 9)]
      )
      if (result.rowCount === 0) {
        throw notFound('announcement not found')
      }
    } else {
      result = await client.query(
        `
          insert into announcements (
            title,
            summary,
            content,
            source_name,
            source_url,
            priority,
            status,
            publish_at,
            expire_at,
            created_by
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          returning id
        `,
        values
      )
    }

    const announcementId = result.rows[0].id
    await replaceTags(client, announcementId, payload.tags || [], operator)
    await replaceTargets(client, announcementId, payload.targets || [])
    return getManagedAnnouncementById(client, announcementId)
  })
}

async function publishAnnouncement(id, operator) {
  return db.withTransaction(async (client) => {
    const result = await client.query(
      `
        update announcements
        set status = 'published',
            published_by = $2,
            published_at = now(),
            publish_at = coalesce(publish_at, now()),
            withdrawn_at = null,
            updated_at = now()
        where id = $1
        returning id, title, status, to_char(publish_at, 'YYYY-MM-DD HH24:MI') as "publishAt"
      `,
      [id, operator.id]
    )
    if (result.rowCount === 0) {
      throw notFound('announcement not found')
    }
    const delivered = await createDeliveries(client, id, notificationProvider.resolveChannels())
    return {
      ...result.rows[0],
      delivered
    }
  })
}

async function dispatchAnnouncement(id, payload = {}) {
  return db.withTransaction(async (client) => {
    const announcementResult = await client.query(
      `
        select id, title, summary, content, source_name as "sourceName", source_url as "sourceUrl"
        from announcements
        where id = $1 and status = 'published'
        limit 1
      `,
      [id]
    )
    if (announcementResult.rowCount === 0) {
      throw notFound('published announcement not found')
    }
    const count = await createDeliveries(client, id, notificationProvider.resolveChannels(payload.channels))
    return { announcementId: Number(id), queued: count }
  })
}

async function listDeliveries(announcementId) {
  const result = await db.query(
    `
      select
        ad.id,
        ad.channel,
        ad.delivery_status as "deliveryStatus",
        ad.error_message as "errorMessage",
        to_char(ad.delivered_at, 'YYYY-MM-DD HH24:MI') as "deliveredAt",
        u.account_name as "accountName",
        s.student_no as "studentNo",
        coalesce(s.name, u.display_name) as name
      from announcement_deliveries ad
      left join users u on u.id = ad.user_id
      left join students s on s.id = u.student_id
      where ad.announcement_id = $1
      order by ad.created_at desc, ad.id desc
      limit 300
    `,
    [announcementId]
  )
  return result.rows
}

async function listSources({ keyword = '' } = {}) {
  const values = []
  const conditions = []
  if (keyword) {
    values.push(`%${keyword}%`)
    conditions.push(`(source_name ilike $${values.length} or source_url ilike $${values.length})`)
  }
  const result = await db.query(
    `
      select
        id,
        source_name as "sourceName",
        source_type as "sourceType",
        source_url as "sourceUrl",
        default_tags as "defaultTags",
        enabled,
        to_char(last_synced_at, 'YYYY-MM-DD HH24:MI') as "lastSyncedAt",
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      from announcement_sources
      ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
      order by enabled desc, updated_at desc, id desc
      limit 100
    `,
    values
  )
  return result.rows
}

async function upsertSource(payload, operator) {
  if (!payload || !payload.sourceName || !payload.sourceUrl) {
    throw badRequest('sourceName and sourceUrl are required')
  }
  const values = [
    payload.sourceName,
    payload.sourceType || 'official_site',
    payload.sourceUrl,
    normalizeTextList(payload.defaultTags || payload.tags),
    payload.enabled !== false,
    operator.id
  ]
  let result
  if (payload.id) {
    result = await db.query(
      `
        update announcement_sources
        set source_name = $2,
            source_type = $3,
            source_url = $4,
            default_tags = $5,
            enabled = $6,
            updated_at = now()
        where id = $1
        returning id, source_name as "sourceName", source_type as "sourceType", source_url as "sourceUrl", default_tags as "defaultTags", enabled
      `,
      [payload.id, ...values.slice(0, 5)]
    )
  } else {
    result = await db.query(
      `
        insert into announcement_sources (source_name, source_type, source_url, default_tags, enabled, created_by)
        values ($1, $2, $3, $4, $5, $6)
        returning id, source_name as "sourceName", source_type as "sourceType", source_url as "sourceUrl", default_tags as "defaultTags", enabled
      `,
      values
    )
  }
  if (result.rowCount === 0) {
    throw notFound('announcement source not found')
  }
  return result.rows[0]
}

async function importFromSource(sourceId, operator) {
  return db.withTransaction(async (client) => {
    const sourceResult = await client.query(
      `
        select id, source_name as "sourceName", source_type as "sourceType", source_url as "sourceUrl", default_tags as "defaultTags"
        from announcement_sources
        where id = $1 and enabled = true
        limit 1
      `,
      [sourceId]
    )
    if (sourceResult.rowCount === 0) {
      throw notFound('enabled announcement source not found')
    }
    const source = sourceResult.rows[0]
    const title = `${source.sourceName}官方通知同步`
    const existing = await client.query(
      'select id from announcements where source_url = $1 limit 1',
      [source.sourceUrl]
    )
    if (existing.rowCount > 0) {
      await client.query('update announcement_sources set last_synced_at = now(), updated_at = now() where id = $1', [sourceId])
      return getManagedAnnouncementById(client, existing.rows[0].id)
    }
    const result = await client.query(
      `
        insert into announcements (title, summary, content, source_name, source_url, priority, status, created_by)
        values ($1, $2, $3, $4, $5, 'normal', 'draft', $6)
        returning id
      `,
      [
        title,
        '由官方来源同步生成的通知草稿，请维护人员复核正文后发布。',
        `来源：${source.sourceUrl}\n\n请打开官方链接核对通知正文后再发布。`,
        source.sourceName,
        source.sourceUrl,
        operator.id
      ]
    )
    await replaceTags(client, result.rows[0].id, splitText(source.defaultTags), operator)
    await client.query('update announcement_sources set last_synced_at = now(), updated_at = now() where id = $1', [sourceId])
    return getManagedAnnouncementById(client, result.rows[0].id)
  })
}

async function withdrawAnnouncement(id) {
  const result = await db.query(
    `
      update announcements
      set status = 'withdrawn',
          withdrawn_at = now(),
          updated_at = now()
      where id = $1
      returning id, title, status
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('announcement not found')
  }
  return result.rows[0]
}

async function archiveAnnouncement(id) {
  const result = await db.query(
    `
      update announcements
      set status = 'archived',
          updated_at = now()
      where id = $1
      returning id, title, status
    `,
    [id]
  )
  if (result.rowCount === 0) {
    throw notFound('announcement not found')
  }
  return result.rows[0]
}

async function upsertTag(payload, operator) {
  if (!payload || !payload.name) {
    throw badRequest('name is required')
  }
  const result = await db.query(
    `
      insert into announcement_tags (tag_name, description, enabled, created_by)
      values ($1, $2, $3, $4)
      on conflict (tag_name)
      do update set description = excluded.description,
                    enabled = excluded.enabled,
                    updated_at = now()
      returning id, tag_name as name, description, enabled
    `,
    [payload.name, payload.description || null, payload.enabled !== false, operator.id]
  )
  return result.rows[0]
}

async function replaceTags(client, announcementId, tags, operator) {
  await client.query('delete from announcement_tag_relations where announcement_id = $1', [announcementId])
  const normalizedTags = uniqueNonEmpty(tags)
  for (const tag of normalizedTags) {
    const tagResult = await client.query(
      `
        insert into announcement_tags (tag_name, enabled, created_by)
        values ($1, true, $2)
        on conflict (tag_name) do update set updated_at = now()
        returning id
      `,
      [tag, operator.id]
    )
    await client.query(
      `
        insert into announcement_tag_relations (announcement_id, tag_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [announcementId, tagResult.rows[0].id]
    )
  }
}

async function replaceTargets(client, announcementId, targets) {
  await client.query('delete from announcement_targets where announcement_id = $1', [announcementId])
  const normalizedTargets = normalizeTargets(targets)
  for (const target of normalizedTargets) {
    await client.query(
      `
        insert into announcement_targets (announcement_id, target_type, target_value)
        values ($1, $2, $3)
        on conflict do nothing
      `,
      [announcementId, target.type, target.value]
    )
  }
}

async function getManagedAnnouncementById(client, id) {
  const result = await client.query(
    `
      select
        a.id,
        a.title,
        a.summary,
        a.content,
        a.source_name as "sourceName",
        a.source_url as "sourceUrl",
        a.priority,
        a.status,
        to_char(a.publish_at, 'YYYY-MM-DD HH24:MI') as "publishAt",
        to_char(a.expire_at, 'YYYY-MM-DD HH24:MI') as "expireAt",
        to_char(a.updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt",
        coalesce(tags.items, '[]') as tags,
        coalesce(targets.items, '[]') as targets
      from announcements a
      left join lateral (
        select json_agg(at.tag_name order by at.tag_name) as items
        from announcement_tag_relations atr
        join announcement_tags at on at.id = atr.tag_id
        where atr.announcement_id = a.id
      ) tags on true
      left join lateral (
        select json_agg(json_build_object('type', target_type, 'value', target_value) order by target_type, target_value) as items
        from announcement_targets atg
        where atg.announcement_id = a.id
      ) targets on true
      where a.id = $1
    `,
    [id]
  )
  return mapAnnouncementRow(result.rows[0])
}

function validateAnnouncementPayload(payload) {
  if (!payload || !payload.title || !payload.content) {
    throw badRequest('title and content are required')
  }
  if (payload.priority && !allowedPriorities.includes(payload.priority)) {
    throw badRequest('invalid priority')
  }
  if (payload.status && !allowedStatuses.includes(payload.status)) {
    throw badRequest('invalid status')
  }
  normalizeTargets(payload.targets || [])
}

function normalizeTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return []
  }
  const seen = new Set()
  const normalized = []
  for (const target of targets) {
    const type = String(target.type || '').trim()
    const value = String(target.value || '').trim()
    if (!allowedTargetTypes.includes(type)) {
      throw badRequest('invalid target type')
    }
    if (!value) {
      throw badRequest('target value is required')
    }
    const key = `${type}:${value}`
    if (!seen.has(key)) {
      seen.add(key)
      normalized.push({ type, value })
    }
  }
  return normalized
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join(',')
  }
  return String(value || '')
}

function splitText(value) {
  return String(value || '')
    .split(/[;,，、|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueNonEmpty(values) {
  if (!Array.isArray(values)) {
    return []
  }
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

async function createDeliveries(client, announcementId, channels = ['miniprogram']) {
  const recipients = await client.query(
    `
      select
        u.id as "userId",
        u.account_name as "accountName",
        u.role,
        s.student_no as "studentNo",
        s.name,
        s.grade,
        s.major,
        s.class_name as "className",
        s.education_level as "educationLevel",
        s.student_status as "studentStatus",
        s.is_alumni as "isAlumni"
      from users u
      left join students s on s.id = u.student_id and s.deleted_at is null
      where u.disabled_at is null
        and ${buildDeliveryAudienceSql()}
      order by u.id asc
    `,
    [announcementId]
  )
  let count = 0
  for (const channel of channels) {
    for (const recipient of recipients.rows) {
      const delivery = await notificationProvider.deliver(channel, { id: announcementId }, recipient)
      const result = await client.query(
        `
          insert into announcement_deliveries (
            announcement_id,
            user_id,
            channel,
            delivery_status,
            error_message,
            delivered_at
          )
          values ($1, $2, $3, $4, $5, case when $4 = 'delivered' then now() else null end)
          on conflict (announcement_id, user_id, channel)
          do update set
            delivery_status = excluded.delivery_status,
            error_message = excluded.error_message,
            delivered_at = coalesce(excluded.delivered_at, announcement_deliveries.delivered_at)
          returning id
        `,
        [announcementId, recipient.userId, channel, delivery.status, delivery.message || null]
      )
      count += result.rowCount
    }
  }
  return count
}

function buildDeliveryAudienceSql() {
  return `(
    not exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'all'
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'role'
        and atg.target_value = u.role
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'student_no'
        and atg.target_value = s.student_no
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'grade'
        and atg.target_value = s.grade
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'major'
        and atg.target_value = s.major
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'class_name'
        and atg.target_value = s.class_name
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'education_level'
        and atg.target_value = s.education_level
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'student_status'
        and atg.target_value = s.student_status
    )
    or exists (
      select 1
      from announcement_targets atg
      where atg.announcement_id = $1
        and atg.target_type = 'is_alumni'
        and atg.target_value = case when s.is_alumni then 'true' else 'false' end
    )
  )`
}

module.exports = {
  listPublishedAnnouncements,
  getAnnouncementDetail,
  markAsRead,
  listTags,
  listManagedAnnouncements,
  upsertAnnouncement,
  publishAnnouncement,
  dispatchAnnouncement,
  listDeliveries,
  listSources,
  upsertSource,
  importFromSource,
  withdrawAnnouncement,
  archiveAnnouncement,
  upsertTag
}
