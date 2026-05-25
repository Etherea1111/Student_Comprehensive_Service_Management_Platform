const api = require('./request')
const { announcements } = require('../data/mockData')

const LOCAL_ANNOUNCEMENTS_KEY = 'local_announcements'
const LOCAL_READS_KEY = 'local_announcement_reads'

function readStorage(key, fallback) {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return fallback
  }
  return wx.getStorageSync(key) || fallback
}

function writeStorage(key, value) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(key, value)
}

function getLocalAnnouncements() {
  const stored = readStorage(LOCAL_ANNOUNCEMENTS_KEY, [])
  return stored.concat(announcements || [])
}

function fetchAnnouncements(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(filterLocalAnnouncements(filters))
  }
  return api
    .request({
      url: '/announcements',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => filterLocalAnnouncements(filters))
}

function filterLocalAnnouncements(filters = {}) {
  const keyword = String(filters.keyword || '').trim()
  const tag = filters.tag
  const reads = readStorage(LOCAL_READS_KEY, [])
  return getLocalAnnouncements()
    .filter((item) => {
      const tagMatched = !tag || tag === '全部' || (item.tags || []).indexOf(tag) >= 0
      const unreadMatched = String(filters.unreadOnly) !== 'true' || reads.indexOf(String(item.id)) < 0
      if (!keyword) {
        return tagMatched && unreadMatched
      }
      const haystack = [item.title, item.summary, item.content, item.sourceName, ...(item.tags || [])].join(' ')
      return tagMatched && unreadMatched && haystack.indexOf(keyword) >= 0
    })
    .map((item) => ({
      ...item,
      isRead: reads.indexOf(String(item.id)) >= 0
    }))
}

function fetchTags() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getLocalTags())
  }
  return api
    .request({
      url: '/announcements/tags'
    })
    .then((result) => result.tags || getLocalTags())
    .catch(() => getLocalTags())
}

function getLocalTags() {
  const tags = []
  getLocalAnnouncements().forEach((item) => {
    ;(item.tags || []).forEach((tag) => {
      if (tags.indexOf(tag) < 0) {
        tags.push(tag)
      }
    })
  })
  return [{ id: 0, name: '全部' }].concat(tags.map((name, index) => ({ id: index + 1, name })))
}

function markAsRead(id) {
  if (!api.isApiEnabled()) {
    const reads = readStorage(LOCAL_READS_KEY, [])
    if (reads.indexOf(String(id)) < 0) {
      reads.push(String(id))
      writeStorage(LOCAL_READS_KEY, reads)
    }
    return Promise.resolve({ id, readAt: new Date().toISOString().slice(0, 16).replace('T', ' ') })
  }
  return api.request({
    url: `/announcements/${id}/read`,
    method: 'POST'
  })
}

function fetchManagedAnnouncements(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getLocalManagedAnnouncements(filters))
  }
  return api
    .request({
      url: '/announcements/manage',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => getLocalManagedAnnouncements(filters))
}

function getLocalManagedAnnouncements(filters = {}) {
  const keyword = String(filters.keyword || '').trim()
  return getLocalAnnouncements().filter((item) => {
    const statusMatched = !filters.status || filters.status === '全部' || item.status === filters.status
    if (!keyword) {
      return statusMatched
    }
    const haystack = [item.title, item.summary, item.content, item.sourceName].join(' ')
    return statusMatched && haystack.indexOf(keyword) >= 0
  })
}

function saveAnnouncement(payload) {
  if (api.isApiEnabled()) {
    return api.request({
      url: '/announcements/manage',
      method: 'POST',
      data: payload
    })
  }

  const stored = readStorage(LOCAL_ANNOUNCEMENTS_KEY, [])
  const saved = {
    id: payload.id || `ann-local-${Date.now()}`,
    ...payload,
    status: payload.status || 'draft',
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
  }
  writeStorage(
    LOCAL_ANNOUNCEMENTS_KEY,
    [saved].concat(stored.filter((item) => String(item.id) !== String(saved.id)))
  )
  return Promise.resolve(saved)
}

function publishAnnouncement(id) {
  if (!api.isApiEnabled()) {
    updateLocalStatus(id, 'published')
    return Promise.resolve({ id, status: 'published', delivered: 1 })
  }
  return api.request({
    url: `/announcements/${id}/publish`,
    method: 'POST'
  })
}

function withdrawAnnouncement(id) {
  if (!api.isApiEnabled()) {
    updateLocalStatus(id, 'withdrawn')
    return Promise.resolve({ id, status: 'withdrawn' })
  }
  return api.request({
    url: `/announcements/${id}/withdraw`,
    method: 'POST'
  })
}

function dispatchAnnouncement(id, channels = ['miniprogram', 'email']) {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ announcementId: id, queued: 1 })
  }
  return api.request({
    url: `/announcements/${id}/dispatch`,
    method: 'POST',
    data: { channels }
  })
}

function fetchDeliveries(id) {
  if (!api.isApiEnabled()) {
    return Promise.resolve([])
  }
  return api
    .request({
      url: `/announcements/${id}/deliveries`
    })
    .then((result) => result.items || [])
    .catch(() => [])
}

function fetchSources(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve([])
  }
  return api
    .request({
      url: '/announcements/manage/sources',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => [])
}

function saveSource(payload) {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ id: payload.id || `source-local-${Date.now()}`, ...payload })
  }
  return api.request({
    url: '/announcements/manage/sources',
    method: 'POST',
    data: payload
  })
}

function importFromSource(id) {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ id: `ann-local-${Date.now()}`, title: '官方来源同步草稿', status: 'draft' })
  }
  return api.request({
    url: `/announcements/manage/sources/${id}/import`,
    method: 'POST'
  })
}

function updateLocalStatus(id, status) {
  const stored = readStorage(LOCAL_ANNOUNCEMENTS_KEY, [])
  writeStorage(
    LOCAL_ANNOUNCEMENTS_KEY,
    stored.map((item) => (String(item.id) === String(id) ? { ...item, status } : item))
  )
}

module.exports = {
  fetchAnnouncements,
  fetchTags,
  markAsRead,
  fetchManagedAnnouncements,
  saveAnnouncement,
  publishAnnouncement,
  withdrawAnnouncement,
  dispatchAnnouncement,
  fetchDeliveries,
  fetchSources,
  saveSource,
  importFromSource
}
