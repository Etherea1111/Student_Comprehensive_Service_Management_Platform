const { knowledgeItems, templates } = require('../data/mockData')
const api = require('./request')

const DRAFT_STORAGE_KEY = 'knowledge_drafts'
const TEMPLATE_STORAGE_KEY = 'managed_templates'
const ARCHIVED_TEMPLATE_STORAGE_KEY = 'archived_template_ids'
const FEEDBACK_STORAGE_KEY = 'knowledge_feedback'

function readDrafts() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(DRAFT_STORAGE_KEY) || []
}

function readStoredTemplates() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(TEMPLATE_STORAGE_KEY) || []
}

function writeStoredTemplates(items) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(TEMPLATE_STORAGE_KEY, items)
}

function readArchivedTemplateIds() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(ARCHIVED_TEMPLATE_STORAGE_KEY) || []
}

function writeArchivedTemplateIds(ids) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(ARCHIVED_TEMPLATE_STORAGE_KEY, ids)
}

function writeDrafts(drafts) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(DRAFT_STORAGE_KEY, drafts)
}

function readFeedback() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(FEEDBACK_STORAGE_KEY) || []
}

function writeFeedback(items) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(FEEDBACK_STORAGE_KEY, items)
}

const semanticSynonymGroups = [
  ['奖学金', '奖助学金', '助学金', '奖助', '资助', '困难补助', '补助', '贫困认定'],
  ['入党', '党员', '党团', '推优', '积极分子', '发展对象', '预备党员', '转正'],
  ['档案', '查档', '学籍档案', '毕业档案', '档案转递'],
  ['宿舍', '寝室', '住宿', '换寝', '调寝'],
  ['请假', '销假', '离校', '返校', '外出'],
  ['证明', '在读证明', '学籍证明', '成绩证明'],
  ['就业', '三方', '协议', '派遣', '就业手续'],
  ['毕业', '延毕', '休学', '复学', '退学', '学籍异动']
]

function normalizeKeyword(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[，。；、,.?？!！;:：()（）【】\[\]\s]+/g, ' ')
}

function tokenizeKeyword(value) {
  const normalized = normalizeKeyword(value)
  const compact = normalized.replace(/\s+/g, '')
  const tokens = normalized.split(' ').map((item) => item.trim()).filter(Boolean)
  const shortTerms = []
  for (let index = 0; index < compact.length - 1; index += 1) {
    shortTerms.push(compact.slice(index, index + 2))
  }
  return Array.from(new Set(tokens.concat(shortTerms))).slice(0, 12)
}

function expandSemanticTokens(value) {
  const normalized = normalizeKeyword(value)
  const compact = normalized.replace(/\s+/g, '')
  const tokens = tokenizeKeyword(value)
  semanticSynonymGroups.forEach((group) => {
    if (group.some((term) => normalized.indexOf(term) >= 0 || compact.indexOf(term) >= 0)) {
      tokens.push.apply(tokens, group)
    }
  })
  return Array.from(new Set(tokens)).slice(0, 24)
}

function buildKnowledgeVector(item) {
  return [item.title, item.category, item.answer].concat(item.tags || [], item.keywords || []).join(' ').toLowerCase()
}

function calculateMatchScore(item, tokens, keyword) {
  const vector = buildKnowledgeVector(item)
  const compactVector = vector.replace(/\s+/g, '')
  const compactKeyword = normalizeKeyword(keyword).replace(/\s+/g, '')
  let score = compactKeyword && compactVector.indexOf(compactKeyword) >= 0 ? 20 : 0
  tokens.forEach((token) => {
    const matched = vector.indexOf(token) >= 0 || compactVector.indexOf(token) >= 0
    if (!matched) {
      return
    }
    if (String(item.title || '').toLowerCase().indexOf(token) >= 0) {
      score += 10
    }
    if ((item.keywords || []).join(' ').toLowerCase().indexOf(token) >= 0) {
      score += 7
    }
    if ((item.tags || []).join(' ').toLowerCase().indexOf(token) >= 0) {
      score += 4
    }
    if (String(item.answer || '').toLowerCase().indexOf(token) >= 0) {
      score += 1
    }
  })
  return score
}

function searchKnowledge(keyword, category) {
  const tokens = expandSemanticTokens(keyword)
  return knowledgeItems
    .filter((item) => !category || category === '全部' || item.category === category)
    .map((item) => {
      const matchScore = calculateMatchScore(item, tokens, keyword)
      const matchTokens = tokens.filter((token) => buildKnowledgeVector(item).indexOf(token) >= 0).slice(0, 5)
      return Object.assign({}, item, {
        matchScore,
        matchType: tokens.length ? '本地语义扩展匹配' : '默认推荐',
        matchTokens,
        matchTokenText: matchTokens.join('、')
      })
    })
    .filter((item) => !tokens.length || item.matchScore > 0)
    .sort((left, right) => right.matchScore - left.matchScore)
}

function fetchKnowledge(keyword, category) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(searchKnowledge(keyword, category))
  }
  return api
    .request({
      url: '/knowledge',
      data: {
        keyword,
        category
      }
    })
    .then((result) => result.items || [])
    .catch(() => searchKnowledge(keyword, category))
}

function getCategories() {
  const categories = knowledgeItems.map((item) => item.category)
  return ['全部'].concat(Array.from(new Set(categories)))
}

function fetchCategories() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getCategories())
  }
  return api
    .request({
      url: '/knowledge/categories'
    })
    .then((result) => result.categories || getCategories())
    .catch(() => getCategories())
}

function getTemplates(category) {
  return templates.filter((item) => !category || category === '全部' || item.category === category)
}

function fetchTemplates(category) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getTemplates(category))
  }
  return api
    .request({
      url: '/templates',
      data: {
        category
      }
    })
    .then((result) => result.items || [])
    .catch(() => getTemplates(category))
}

function fetchManagedTemplates(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getLocalManagedTemplates(filters))
  }
  return api
    .request({
      url: '/templates/manage',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => getLocalManagedTemplates(filters))
}

function getLocalManagedTemplates(filters = {}) {
  const keyword = normalizeKeyword(filters.keyword)
  const archivedIds = readArchivedTemplateIds().map((id) => String(id))
  const baseItems = templates
    .map((item) => ({
      ...item,
      fileType: String(item.type || '').toLowerCase(),
      status: 'published',
      statusText: '已发布',
      owner: item.owner || '学院团委'
    }))
    .filter((item) => archivedIds.indexOf(String(item.id)) < 0)
  const storedItems = readStoredTemplates()
  return storedItems
    .concat(baseItems)
    .filter((item) => {
      const statusMatched = !filters.status || filters.status === '全部' || item.status === filters.status
      const categoryMatched = !filters.category || filters.category === '全部' || item.category === filters.category
      if (!keyword) {
        return statusMatched && categoryMatched
      }
      const haystack = [item.name, item.category, item.description, item.owner].join(' ').toLowerCase()
      return statusMatched && categoryMatched && haystack.indexOf(keyword) >= 0
    })
}

function saveTemplate(payload) {
  if (!api.isApiEnabled()) {
    const storedTemplates = readStoredTemplates()
    const saved = {
      id: payload.id || `tpl-local-${Date.now()}`,
      ...payload,
      type: String(payload.fileType || '').toUpperCase(),
      status: 'published',
      statusText: '已发布',
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    }
    const nextTemplates = storedTemplates.filter((item) => String(item.id) !== String(saved.id))
    nextTemplates.unshift(saved)
    writeStoredTemplates(nextTemplates)
    return Promise.resolve(saved)
  }
  return api.request({
    url: '/templates',
    method: 'PUT',
    data: payload
  })
}

function uploadTemplateFile(filePath) {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ id: `tpl-file-local-${Date.now()}`, url: '', size: '' })
  }
  return api.uploadFile({
    url: '/templates/files',
    filePath,
    name: 'file'
  })
}

function archiveTemplate(id) {
  if (!api.isApiEnabled()) {
    const storedTemplates = readStoredTemplates().map((item) =>
      String(item.id) === String(id)
        ? {
            ...item,
            status: 'archived',
            statusText: '已归档'
          }
        : item
    )
    writeStoredTemplates(storedTemplates)
    const archivedIds = readArchivedTemplateIds()
    if (archivedIds.map((item) => String(item)).indexOf(String(id)) < 0) {
      archivedIds.push(id)
      writeArchivedTemplateIds(archivedIds)
    }
    return Promise.resolve({ id, status: 'archived' })
  }
  return api.request({
    url: `/templates/${id}/archive`,
    method: 'POST'
  })
}

function getTemplateCategories() {
  const categories = templates.map((item) => item.category)
  return ['全部'].concat(Array.from(new Set(categories)))
}

function fetchTemplateCategories() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getTemplateCategories())
  }
  return api
    .request({
      url: '/templates/categories'
    })
    .then((result) => result.categories || getTemplateCategories())
    .catch(() => getTemplateCategories())
}

function addKnowledgeDraft(payload) {
  if (api.isApiEnabled()) {
    return api
      .request({
        url: '/knowledge/drafts',
        method: 'POST',
        data: payload
      })
      .catch(() => createLocalDraft(payload))
  }
  return Promise.resolve(createLocalDraft(payload))
}

function uploadKnowledgeFile(filePath) {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ id: `file-local-${Date.now()}`, originalName: '本地文件', fileType: 'file' })
  }
  return api.uploadFile({
    url: '/knowledge/files',
    filePath,
    name: 'file'
  })
}

function createLocalDraft(payload) {
  const draft = {
    id: `draft-${Date.now()}`,
    status: 'draft',
    statusText: '待复核',
    maxFileSizeMB: 30,
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    ...payload
  }
  const drafts = readDrafts()
  drafts.unshift(draft)
  writeDrafts(drafts)
  return draft
}

function getKnowledgeDrafts() {
  return readDrafts()
}

function fetchManagedKnowledge(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getLocalManagedKnowledge(filters))
  }
  return api
    .request({
      url: '/knowledge/manage',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => getLocalManagedKnowledge(filters))
}

function getLocalManagedKnowledge(filters = {}) {
  const localDrafts = readDrafts().map((item) => ({
    ...item,
    tags: item.tags || [],
    keywords: item.keywords || [],
    status: item.status || 'draft',
    statusText: '待复核',
    createdAt: item.createdAt || '',
    updatedAt: item.createdAt || ''
  }))
  const publishedItems = knowledgeItems.map((item) => ({
    ...item,
    keywords: item.keywords || [],
    status: 'published',
    statusText: '已发布',
    createdAt: item.updatedAt,
    updatedAt: item.updatedAt
  }))
  const keyword = normalizeKeyword(filters.keyword)
  return localDrafts.concat(publishedItems).filter((item) => {
    const statusMatched = !filters.status || filters.status === '全部' || item.status === filters.status
    const categoryMatched = !filters.category || filters.category === '全部' || item.category === filters.category
    if (!keyword) {
      return statusMatched && categoryMatched
    }
    const haystack = [
      item.title,
      item.category,
      item.answer,
      ...(item.tags || []),
      ...(item.keywords || [])
    ]
      .join(' ')
      .toLowerCase()
    return statusMatched && categoryMatched && haystack.indexOf(keyword) >= 0
  })
}

function publishKnowledgeDraft(id) {
  if (!api.isApiEnabled()) {
    updateLocalDraftStatus(id, 'published', '已发布')
    return Promise.resolve({ id, status: 'published' })
  }
  return api.request({
    url: `/knowledge/drafts/${id}/publish`,
    method: 'POST'
  })
}

function rejectKnowledgeDraft(id, reason) {
  if (!api.isApiEnabled()) {
    updateLocalDraftStatus(id, 'rejected', '已退回', reason)
    return Promise.resolve({ id, status: 'rejected', reviewComment: reason })
  }
  return api.request({
    url: `/knowledge/drafts/${id}/reject`,
    method: 'POST',
    data: {
      reason
    }
  })
}

function archiveKnowledgeItem(id) {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ id, status: 'archived' })
  }
  return api.request({
    url: `/knowledge/${id}/archive`,
    method: 'POST'
  })
}

function updateLocalDraftStatus(id, status, statusText, reviewComment) {
  const drafts = readDrafts().map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          statusText,
          reviewComment: reviewComment || item.reviewComment || ''
        }
      : item
  )
  writeDrafts(drafts)
}

function submitKnowledgeFeedback(payload) {
  if (!api.isApiEnabled()) {
    const item = {
      id: `feedback-${Date.now()}`,
      status: 'open',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ...payload
    }
    const items = readFeedback()
    items.unshift(item)
    writeFeedback(items)
    return Promise.resolve(item)
  }
  return api.request({
    url: '/knowledge/feedback',
    method: 'POST',
    data: {
      ...payload,
      knowledgeItemId: /^\d+$/.test(String(payload.knowledgeItemId || '')) ? payload.knowledgeItemId : undefined
    }
  })
}

function fetchKnowledgeFeedback(filters = {}) {
  if (!api.isApiEnabled()) {
    const keyword = normalizeKeyword(filters.keyword)
    return Promise.resolve(
      readFeedback().filter((item) => {
        const statusMatched = !filters.status || filters.status === '全部' || item.status === filters.status
        if (!keyword) {
          return statusMatched
        }
        const haystack = [item.queryText, item.comment, item.feedbackType].join(' ').toLowerCase()
        return statusMatched && haystack.indexOf(keyword) >= 0
      })
    )
  }
  return api
    .request({
      url: '/knowledge/feedback/manage',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => [])
}

function handleKnowledgeFeedback(id) {
  if (!api.isApiEnabled()) {
    const items = readFeedback().map((item) =>
      String(item.id) === String(id)
        ? {
            ...item,
            status: 'handled',
            handledAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
          }
        : item
    )
    writeFeedback(items)
    return Promise.resolve({ id, status: 'handled' })
  }
  return api.request({
    url: `/knowledge/feedback/${id}/handle`,
    method: 'POST'
  })
}

function fetchKnowledgeVersions(id) {
  if (!api.isApiEnabled()) {
    return Promise.resolve([])
  }
  return api
    .request({
      url: `/knowledge/${id}/versions`
    })
    .then((result) => result.items || [])
    .catch(() => [])
}

module.exports = {
  searchKnowledge,
  fetchKnowledge,
  getCategories,
  fetchCategories,
  getTemplates,
  fetchTemplates,
  fetchManagedTemplates,
  uploadTemplateFile,
  saveTemplate,
  archiveTemplate,
  getTemplateCategories,
  fetchTemplateCategories,
  addKnowledgeDraft,
  uploadKnowledgeFile,
  getKnowledgeDrafts,
  fetchManagedKnowledge,
  publishKnowledgeDraft,
  rejectKnowledgeDraft,
  archiveKnowledgeItem,
  submitKnowledgeFeedback,
  fetchKnowledgeFeedback,
  handleKnowledgeFeedback,
  fetchKnowledgeVersions
}
