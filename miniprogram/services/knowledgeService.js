const { knowledgeItems, templates } = require('../data/mockData')
const api = require('./request')

const DRAFT_STORAGE_KEY = 'knowledge_drafts'

function readDrafts() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(DRAFT_STORAGE_KEY) || []
}

function writeDrafts(drafts) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(DRAFT_STORAGE_KEY, drafts)
}

function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase()
}

function searchKnowledge(keyword, category) {
  const query = normalizeKeyword(keyword)
  return knowledgeItems.filter((item) => {
    const categoryMatched = !category || category === '全部' || item.category === category
    if (!query) {
      return categoryMatched
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
    return categoryMatched && haystack.indexOf(query) >= 0
  })
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
  return createLocalDraft(payload)
}

function createLocalDraft(payload) {
  const draft = {
    id: `draft-${Date.now()}`,
    status: 'pending_review',
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

module.exports = {
  searchKnowledge,
  fetchKnowledge,
  getCategories,
  fetchCategories,
  getTemplates,
  fetchTemplates,
  getTemplateCategories,
  fetchTemplateCategories,
  addKnowledgeDraft,
  getKnowledgeDrafts
}
