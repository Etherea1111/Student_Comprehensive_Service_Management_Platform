const db = require('../db/pool')
const { badRequest, notFound } = require('../utils/errors')

const allowedPriorities = ['low', 'normal', 'high', 'urgent']
const allowedStatuses = ['draft', 'published', 'withdrawn', 'archived']
const allowedTargetTypes = ['all', 'role', 'grade', 'major', 'class_name', 'education_level', 'student_no']

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
  const result = await db.query(
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
  return result.rows[0]
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

function uniqueNonEmpty(values) {
  if (!Array.isArray(values)) {
    return []
  }
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

module.exports = {
  listPublishedAnnouncements,
  getAnnouncementDetail,
  markAsRead,
  listTags,
  listManagedAnnouncements,
  upsertAnnouncement,
  publishAnnouncement,
  withdrawAnnouncement,
  archiveAnnouncement,
  upsertTag
}
