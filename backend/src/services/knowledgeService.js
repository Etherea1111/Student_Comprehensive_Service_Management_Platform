const fs = require('fs')
const path = require('path')
const xlsx = require('xlsx')
const db = require('../db/pool')
const { badRequest, notFound } = require('../utils/errors')

const statusTextMap = {
  draft: '待复核',
  published: '已发布',
  rejected: '已退回',
  archived: '已归档'
}

function splitText(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join(',')
  }
  return String(value || '')
}

function tokenizeKeyword(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[，。；、,.?？!！;:：()（）【】\[\]\s]+/g, ' ')
  return Array.from(new Set(normalized.split(' ').map((item) => item.trim()).filter(Boolean))).slice(0, 6)
}


function normalizeImportedText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function truncateText(value, maxLength = 6000) {
  const normalized = normalizeImportedText(value)
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength)}\n\n（内容已截断，请下载原文件核对完整文本。）`
}

function parseFileExtension(file) {
  return String(path.extname(file.originalname || '').replace('.', '') || 'file').toLowerCase()
}

function parseWorkbookText(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true })
  return workbook.SheetNames.map((sheetName) => {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' })
    const content = rows
      .map((row) => row.map((cell) => String(cell || '').trim()).filter(Boolean).join(' '))
      .filter(Boolean)
      .join('\n')
    return content ? `【${sheetName}】\n${content}` : ''
  }).filter(Boolean).join('\n\n')
}

function extractKnowledgeText(file) {
  const extension = parseFileExtension(file)
  if (['txt', 'md', 'csv'].includes(extension)) {
    return {
      text: fs.readFileSync(file.path, 'utf8'),
      supported: true
    }
  }
  if (['xls', 'xlsx'].includes(extension)) {
    return {
      text: parseWorkbookText(file.path),
      supported: true
    }
  }
  return {
    text: '',
    supported: false
  }
}

function buildImportedDraftPayload(file, body = {}, operator, extracted) {
  const baseName = path.basename(file.originalname || '知识库导入文件', path.extname(file.originalname || ''))
  const title = String(body.title || baseName).trim()
  const category = String(body.category || '待分类').trim()
  const tags = Array.from(new Set([...splitText(body.tags), '文件导入']))
  const sourceNote = `\n\n来源文件：${file.originalname || '知识库导入文件'}`
  const answer = extracted.supported && normalizeImportedText(extracted.text)
    ? `${truncateText(extracted.text)}${sourceNote}`
    : `已上传文件《${file.originalname || '知识库导入文件'}》。当前版本暂未自动解析该文件格式，请维护人员下载原文件核对正文后补充标准答复。`
  const keywords = Array.from(new Set([
    ...splitText(body.keywords),
    ...tokenizeKeyword(title),
    ...tokenizeKeyword(category),
    ...tags
  ])).slice(0, 10)

  return {
    title,
    category,
    tags,
    keywords,
    answer,
    officialLink: body.officialLink || null,
    sensitiveHint: body.sensitiveHint || (extracted.supported ? '文件解析生成草稿，请人工复核后发布。' : '该格式暂未自动解析，请人工补录正文后发布。'),
    owner: body.owner || operator.name || '知识库维护人员'
  }
}

function mapKnowledgeRow(row) {
  return {
    ...row,
    tags: splitText(row.tagsText),
    keywords: splitText(row.keywordsText),
    files: parseJsonArray(row.files),
    statusText: statusTextMap[row.status] || row.status
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

async function searchKnowledge({ keyword, category }) {
  const values = []
  const conditions = ["status = 'published'"]
  const scoreParts = ['0']

  if (category && category !== '全部') {
    values.push(category)
    conditions.push(`category = $${values.length}`)
  }

  if (keyword) {
    const tokens = tokenizeKeyword(keyword)
    if (tokens.length) {
      const tokenConditions = []
      tokens.forEach((token) => {
        values.push(`%${token}%`)
        const idx = values.length
        tokenConditions.push(`(title ilike $${idx} or answer ilike $${idx} or keywords_text ilike $${idx} or tags_text ilike $${idx})`)
        scoreParts.push(`case when title ilike $${idx} then 8 else 0 end`)
        scoreParts.push(`case when keywords_text ilike $${idx} then 5 else 0 end`)
        scoreParts.push(`case when tags_text ilike $${idx} then 3 else 0 end`)
        scoreParts.push(`case when answer ilike $${idx} then 1 else 0 end`)
      })
      conditions.push(`(${tokenConditions.join(' or ')})`)
    }
  }

  const result = await db.query(
    `
      select
        id,
        title,
        category,
        tags_text as "tagsText",
        answer,
        official_link as "officialLink",
        sensitive_hint as "sensitiveHint",
        owner,
        (${scoreParts.join(' + ')}) as "matchScore",
        to_char(updated_at, 'YYYY-MM-DD') as "updatedAt"
      from knowledge_items
      where ${conditions.join(' and ')}
      order by "matchScore" desc, updated_at desc, title asc
      limit 50
    `,
    values
  )
  return result.rows.map(mapKnowledgeRow)
}

async function getCategories() {
  const result = await db.query(
    `
      select distinct category
      from knowledge_items
      where status = 'published'
      order by category
    `
  )
  return ['全部', ...result.rows.map((row) => row.category)]
}

async function createDraft(payload, operator) {
  validateKnowledgePayload(payload)
  return db.withTransaction(async (client) => {
    const result = await client.query(
      `
        insert into knowledge_items (
          title,
          category,
          tags_text,
          keywords_text,
          answer,
          official_link,
          sensitive_hint,
          owner,
          status,
          created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
        returning id, title, category, answer, status
      `,
      [
        payload.title,
        payload.category,
        normalizeTextList(payload.tags),
        normalizeTextList(payload.keywords),
        payload.answer,
        payload.officialLink || null,
        payload.sensitiveHint || null,
        payload.owner || operator.name,
        operator.id
      ]
    )
    const item = result.rows[0]
    await attachFiles(client, item.id, payload.fileIds || [], operator)
    return item
  })
}

async function listManagedKnowledge({ status, keyword, category } = {}) {
  const values = []
  const conditions = []

  if (status && status !== '全部') {
    values.push(status)
    conditions.push(`status = $${values.length}`)
  }
  if (category && category !== '全部') {
    values.push(category)
    conditions.push(`category = $${values.length}`)
  }
  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(title ilike $${idx} or answer ilike $${idx} or keywords_text ilike $${idx} or tags_text ilike $${idx})`)
  }

  const result = await db.query(
    `
	      select
        id,
        title,
        category,
        tags_text as "tagsText",
        keywords_text as "keywordsText",
        answer,
        official_link as "officialLink",
        sensitive_hint as "sensitiveHint",
        owner,
        status,
        review_comment as "reviewComment",
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt",
        to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt",
        to_char(reviewed_at, 'YYYY-MM-DD HH24:MI') as "reviewedAt",
        coalesce(attached_files.files, '[]') as files
	      from knowledge_items
	      left join lateral (
	        select json_agg(json_build_object(
	          'id', uf.id,
	          'originalName', uf.original_name,
	          'fileType', uf.file_type,
	          'fileSize', uf.file_size,
	          'downloadPath', concat('/knowledge/files/', uf.id, '/download')
	        ) order by uf.created_at asc) as files
	        from knowledge_item_files kif
	        join uploaded_files uf on uf.id = kif.file_id
	        where kif.knowledge_item_id = knowledge_items.id
	      ) attached_files on true
	      ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
      order by
        case status
          when 'draft' then 1
          when 'rejected' then 2
          when 'published' then 3
          else 4
        end,
        updated_at desc,
        id desc
	      limit 100
    `,
    values
  )
  return result.rows.map(mapKnowledgeRow)
}

async function updateKnowledgeItem(id, payload, operator) {
  validateKnowledgePayload(payload)
  return db.withTransaction(async (client) => {
    const before = await getKnowledgeSnapshot(client, id)
    const result = await client.query(
      `
        update knowledge_items
        set title = $2,
            category = $3,
            tags_text = $4,
            keywords_text = $5,
            answer = $6,
            official_link = $7,
            sensitive_hint = $8,
            owner = $9,
            status = 'draft',
            reviewed_by = null,
            reviewed_at = null,
            review_comment = null,
            updated_at = now()
        where id = $1
        returning
          id,
          title,
          category,
          tags_text as "tagsText",
          keywords_text as "keywordsText",
          answer,
          official_link as "officialLink",
          sensitive_hint as "sensitiveHint",
          owner,
          status,
          review_comment as "reviewComment",
          to_char(updated_at, 'YYYY-MM-DD HH24:MI') as "updatedAt"
      `,
      [
        id,
        payload.title,
        payload.category,
        normalizeTextList(payload.tags),
        normalizeTextList(payload.keywords),
        payload.answer,
        payload.officialLink || null,
        payload.sensitiveHint || null,
        payload.owner || operator.name
      ]
    )
    if (result.rowCount === 0) {
      throw notFound('knowledge item not found')
    }
    await attachFiles(client, id, payload.fileIds || [], operator)
    if (before) {
      await insertKnowledgeVersion(client, before, 'update', operator, payload.comment || null)
    }
    return mapKnowledgeRow(result.rows[0])
  })
}

async function uploadKnowledgeFile(file, operator, client = db) {
  if (!file || !file.path) {
    throw badRequest('file is required')
  }
  const fileType = parseFileExtension(file)
  const result = await client.query(
    `
      insert into uploaded_files (
        original_name,
        storage_path,
        file_type,
        file_size,
        owner_id,
        visibility
      )
      values ($1, $2, $3, $4, $5, 'private')
      returning
        id,
        original_name as "originalName",
        file_type as "fileType",
        file_size as "fileSize",
        concat('/knowledge/files/', id, '/download') as "downloadPath",
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
    `,
    [file.originalname || 'knowledge-file', file.path, fileType, file.size || 0, operator.id]
  )
  return result.rows[0]
}

async function importKnowledgeFileAsDraft(file, payload, operator) {
  if (!file || !file.path) {
    throw badRequest('file is required')
  }
  const extracted = extractKnowledgeText(file)
  const draftPayload = buildImportedDraftPayload(file, payload, operator, extracted)
  validateKnowledgePayload(draftPayload)

  return db.withTransaction(async (client) => {
    const uploadedFile = await uploadKnowledgeFile(file, operator, client)
    const result = await client.query(
      `
        insert into knowledge_items (
          title,
          category,
          tags_text,
          keywords_text,
          answer,
          official_link,
          sensitive_hint,
          owner,
          status,
          created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
        returning id, title, category, answer, status
      `,
      [
        draftPayload.title,
        draftPayload.category,
        normalizeTextList(draftPayload.tags),
        normalizeTextList(draftPayload.keywords),
        draftPayload.answer,
        draftPayload.officialLink || null,
        draftPayload.sensitiveHint || null,
        draftPayload.owner || operator.name,
        operator.id
      ]
    )
    const draft = result.rows[0]
    await attachFiles(client, draft.id, [uploadedFile.id], operator)
    return {
      file: uploadedFile,
      draft,
      parsed: extracted.supported && Boolean(normalizeImportedText(extracted.text))
    }
  })
}

async function getKnowledgeFileDownload(fileId, user) {
  const result = await db.query(
    `
      select
        id,
        original_name as "originalName",
        storage_path as "storagePath",
        owner_id as "ownerId",
        visibility
      from uploaded_files
      where id = $1
      limit 1
    `,
    [fileId]
  )
  if (result.rowCount === 0) {
    throw notFound('file not found')
  }
  const row = result.rows[0]
  const permissions = (user && user.permissions) || []
  const canManage = permissions.includes('manage_public_content') || permissions.includes('manage_all')
  if (row.visibility !== 'public' && Number(row.ownerId) !== Number(user.id) && !canManage) {
    throw notFound('file not found')
  }
  return row
}

async function attachFiles(client, knowledgeItemId, fileIds, operator) {
  const normalizedIds = Array.from(new Set((fileIds || []).map((id) => Number(id)).filter(Boolean)))
  if (normalizedIds.length === 0) {
    return
  }
  const fileResult = await client.query(
    `
      select id
      from uploaded_files
      where id = any($1::bigint[])
        and (owner_id = $2 or visibility = 'public')
    `,
    [normalizedIds, operator.id]
  )
  const allowedIds = fileResult.rows.map((row) => row.id)
  for (const fileId of allowedIds) {
    await client.query(
      `
        insert into knowledge_item_files (knowledge_item_id, file_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [knowledgeItemId, fileId]
    )
  }
}

async function publishDraft(id, operator) {
  return db.withTransaction(async (client) => {
    const before = await getKnowledgeSnapshot(client, id)
    const result = await client.query(
      `
        update knowledge_items
        set status = 'published',
            reviewed_by = $2,
            reviewed_at = now(),
            review_comment = null,
            updated_at = now()
        where id = $1
        returning id, title, category, status
      `,
      [id, operator.id]
    )
    if (result.rowCount === 0) {
      throw notFound('knowledge draft not found')
    }
    if (before) {
      await insertKnowledgeVersion(client, before, 'publish', operator)
    }
    return result.rows[0]
  })
}

async function rejectDraft(id, operator, payload = {}) {
  const comment = String(payload.reason || payload.comment || '').trim()
  if (!comment) {
    throw badRequest('reject reason is required')
  }
  return db.withTransaction(async (client) => {
    const before = await getKnowledgeSnapshot(client, id)
    const result = await client.query(
      `
        update knowledge_items
        set status = 'rejected',
            reviewed_by = $2,
            reviewed_at = now(),
            review_comment = $3,
            updated_at = now()
        where id = $1 and status = 'draft'
        returning id, title, category, status, review_comment as "reviewComment"
      `,
      [id, operator.id, comment]
    )
    if (result.rowCount === 0) {
      throw notFound('pending knowledge draft not found')
    }
    if (before) {
      await insertKnowledgeVersion(client, before, 'reject', operator, comment)
    }
    return result.rows[0]
  })
}

async function archiveKnowledgeItem(id, operator) {
  return db.withTransaction(async (client) => {
    const before = await getKnowledgeSnapshot(client, id)
    const result = await client.query(
      `
        update knowledge_items
        set status = 'archived',
            updated_at = now()
        where id = $1
        returning id, title, category, status
      `,
      [id]
    )
    if (result.rowCount === 0) {
      throw notFound('knowledge item not found')
    }
    if (before) {
      await insertKnowledgeVersion(client, before, 'archive', operator)
    }
    return result.rows[0]
  })
}

function validateKnowledgePayload(payload) {
  if (!payload || !payload.title || !payload.category || !payload.answer) {
    throw badRequest('title, category and answer are required')
  }
}

async function submitFeedback(payload, user) {
  const feedbackType = String(payload.feedbackType || payload.type || 'unresolved').trim()
  const comment = String(payload.comment || '').trim()
  const queryText = String(payload.queryText || payload.keyword || '').trim()
  const knowledgeItemId = payload.knowledgeItemId ? Number(payload.knowledgeItemId) : null

  if (!comment && !queryText && !knowledgeItemId) {
    throw badRequest('feedback content is required')
  }

  const result = await db.query(
    `
      insert into knowledge_feedback (
        knowledge_item_id,
        user_id,
        query_text,
        feedback_type,
        comment
      )
      values ($1, $2, $3, $4, $5)
      returning
        id,
        knowledge_item_id as "knowledgeItemId",
        query_text as "queryText",
        feedback_type as "feedbackType",
        comment,
        status,
        to_char(created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
    `,
    [knowledgeItemId, user ? user.id : null, queryText || null, feedbackType || 'unresolved', comment || null]
  )
  return result.rows[0]
}

async function listFeedback({ status, keyword } = {}) {
  const values = []
  const conditions = []
  if (status && status !== '全部') {
    values.push(status)
    conditions.push(`kf.status = $${values.length}`)
  }
  if (keyword) {
    values.push(`%${keyword}%`)
    const idx = values.length
    conditions.push(`(kf.query_text ilike $${idx} or kf.comment ilike $${idx} or ki.title ilike $${idx})`)
  }
  const result = await db.query(
    `
      select
        kf.id,
        kf.knowledge_item_id as "knowledgeItemId",
        ki.title as "knowledgeTitle",
        kf.query_text as "queryText",
        kf.feedback_type as "feedbackType",
        kf.comment,
        kf.status,
        u.name as "userName",
        handler.name as "handledByName",
        to_char(kf.created_at, 'YYYY-MM-DD HH24:MI') as "createdAt",
        to_char(kf.handled_at, 'YYYY-MM-DD HH24:MI') as "handledAt"
      from knowledge_feedback kf
      left join knowledge_items ki on ki.id = kf.knowledge_item_id
      left join users u on u.id = kf.user_id
      left join users handler on handler.id = kf.handled_by
      ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
      order by
        case kf.status when 'open' then 1 when 'handled' then 2 else 3 end,
        kf.created_at desc
      limit 200
    `,
    values
  )
  return result.rows
}

async function handleFeedback(id, operator) {
  const result = await db.query(
    `
      update knowledge_feedback
      set status = 'handled',
          handled_by = $2,
          handled_at = now()
      where id = $1
      returning id, status, to_char(handled_at, 'YYYY-MM-DD HH24:MI') as "handledAt"
    `,
    [id, operator.id]
  )
  if (result.rowCount === 0) {
    throw notFound('knowledge feedback not found')
  }
  return result.rows[0]
}

async function listVersions(id) {
  const result = await db.query(
    `
      select
        kiv.id,
        kiv.knowledge_item_id as "knowledgeItemId",
        kiv.title,
        kiv.category,
        kiv.tags_text as "tagsText",
        kiv.keywords_text as "keywordsText",
        kiv.answer,
        kiv.official_link as "officialLink",
        kiv.sensitive_hint as "sensitiveHint",
        kiv.owner,
        kiv.status,
        kiv.action,
        kiv.comment,
        u.name as "operatorName",
        to_char(kiv.created_at, 'YYYY-MM-DD HH24:MI') as "createdAt"
      from knowledge_item_versions kiv
      left join users u on u.id = kiv.operator_id
      where kiv.knowledge_item_id = $1
      order by kiv.created_at desc, kiv.id desc
      limit 100
    `,
    [id]
  )
  return result.rows.map(mapKnowledgeRow)
}

async function getKnowledgeSnapshot(client, id) {
  const result = await client.query(
    `
      select
        id,
        title,
        category,
        tags_text,
        keywords_text,
        answer,
        official_link,
        sensitive_hint,
        owner,
        status
      from knowledge_items
      where id = $1
      limit 1
    `,
    [id]
  )
  return result.rows[0] || null
}

async function insertKnowledgeVersion(client, item, action, operator, comment = null) {
  await client.query(
    `
      insert into knowledge_item_versions (
        knowledge_item_id,
        title,
        category,
        tags_text,
        keywords_text,
        answer,
        official_link,
        sensitive_hint,
        owner,
        status,
        action,
        comment,
        operator_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `,
    [
      item.id,
      item.title,
      item.category,
      item.tags_text,
      item.keywords_text,
      item.answer,
      item.official_link,
      item.sensitive_hint,
      item.owner,
      item.status,
      action,
      comment,
      operator && operator.id
    ]
  )
}

module.exports = {
  searchKnowledge,
  getCategories,
  createDraft,
  listManagedKnowledge,
  updateKnowledgeItem,
  uploadKnowledgeFile,
  importKnowledgeFileAsDraft,
  getKnowledgeFileDownload,
  publishDraft,
  rejectDraft,
  archiveKnowledgeItem,
  submitFeedback,
  listFeedback,
  handleFeedback,
  listVersions
}
