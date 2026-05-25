const api = require('./request')

const LOCAL_WORK_RECORDS_KEY = 'local_work_records'

function readLocalRecords() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(LOCAL_WORK_RECORDS_KEY) || []
}

function writeLocalRecords(items) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(LOCAL_WORK_RECORDS_KEY, items)
}

function fetchWorkRecords(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(filterLocalRecords(filters))
  }
  return api
    .request({
      url: '/work-records',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => filterLocalRecords(filters))
}

function saveWorkRecord(payload) {
  if (!api.isApiEnabled()) {
    const saved = {
      id: payload.id || `work-local-${Date.now()}`,
      ...payload,
      recordTypeText: getRecordTypeText(payload.recordType),
      statusText: payload.status === 'archived' ? '已归档' : payload.status === 'draft' ? '草稿' : '已发布',
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    }
    writeLocalRecords([saved].concat(readLocalRecords().filter((item) => String(item.id) !== String(saved.id))))
    return Promise.resolve(saved)
  }
  return api.request({
    url: '/work-records',
    method: 'PUT',
    data: payload
  })
}

function archiveWorkRecord(id) {
  if (!api.isApiEnabled()) {
    const next = readLocalRecords().map((item) =>
      String(item.id) === String(id) ? { ...item, status: 'archived', statusText: '已归档' } : item
    )
    writeLocalRecords(next)
    return Promise.resolve({ id, status: 'archived' })
  }
  return api.request({
    url: `/work-records/${id}/archive`,
    method: 'POST'
  })
}

function filterLocalRecords(filters = {}) {
  const keyword = String(filters.keyword || '').trim()
  return readLocalRecords().filter((item) => {
    const typeMatched = !filters.recordType || filters.recordType === '全部' || item.recordType === filters.recordType
    const statusMatched = !filters.status || filters.status === '全部' || item.status === filters.status
    if (!keyword) {
      return typeMatched && statusMatched
    }
    const haystack = [item.title, item.organizer, item.content, item.materialsSummary].join(' ')
    return typeMatched && statusMatched && haystack.indexOf(keyword) >= 0
  })
}

function getRecordTypeText(recordType) {
  const map = {
    party: '党务记录',
    league: '团务记录',
    student_org: '学生组织',
    class_affairs: '班级事务',
    other: '其他'
  }
  return map[recordType] || recordType
}

module.exports = {
  fetchWorkRecords,
  saveWorkRecord,
  archiveWorkRecord
}
