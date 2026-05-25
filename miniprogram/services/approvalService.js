const api = require('./request')
const profileService = require('./profileService')

const LOCAL_APPROVALS_KEY = 'local_approval_requests'

function readLocalRequests() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(LOCAL_APPROVALS_KEY) || []
}

function writeLocalRequests(items) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(LOCAL_APPROVALS_KEY, items)
}

function fetchMyRequests() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(readLocalRequests())
  }
  return api
    .request({
      url: '/approvals/mine'
    })
    .then((result) => result.items || [])
    .catch(() => readLocalRequests())
}

function fetchManagedRequests(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getLocalManagedRequests(filters))
  }
  return api
    .request({
      url: '/approvals/manage',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => getLocalManagedRequests(filters))
}

function getLocalManagedRequests(filters = {}) {
  const keyword = String(filters.keyword || '').trim()
  const status = filters.status
  return readLocalRequests().filter((item) => {
    const statusMatched = !status || status === '全部' || item.status === status
    if (!keyword) {
      return statusMatched
    }
    const haystack = [item.requestNo, item.title, item.studentNo, item.studentName].join(' ')
    return statusMatched && haystack.indexOf(keyword) >= 0
  })
}

function saveRequest(payload) {
  if (api.isApiEnabled()) {
    return api.request({
      url: '/approvals',
      method: 'POST',
      data: payload
    })
  }
  return Promise.resolve(saveLocalRequest(payload))
}

function submitRequest(id) {
  if (api.isApiEnabled()) {
    return api.request({
      url: `/approvals/${id}/submit`,
      method: 'POST'
    })
  }
  return Promise.resolve(updateLocalRequest(id, { status: 'pending', statusText: '待审批', currentStepText: '辅导员审批' }))
}

function fetchRequestDetail(id) {
  if (api.isApiEnabled()) {
    return api.request({
      url: `/approvals/${id}`
    })
  }
  const item = readLocalRequests().find((request) => String(request.id) === String(id))
  return Promise.resolve(item || null)
}

function withdrawRequest(id) {
  if (api.isApiEnabled()) {
    return api.request({
      url: `/approvals/${id}/withdraw`,
      method: 'POST'
    })
  }
  return Promise.resolve(updateLocalRequest(id, { status: 'withdrawn', statusText: '已撤回' }))
}

function approveRequest(id, comment) {
  if (api.isApiEnabled()) {
    return api.request({
      url: `/approvals/${id}/approve`,
      method: 'POST',
      data: { comment }
    })
  }
  return Promise.resolve(
    updateLocalRequest(id, {
      status: 'approved',
      statusText: '已通过',
      currentStepText: '已完成',
      approvedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    })
  )
}

function rejectRequest(id, reason) {
  if (api.isApiEnabled()) {
    return api.request({
      url: `/approvals/${id}/reject`,
      method: 'POST',
      data: { reason }
    })
  }
  return Promise.resolve(
    updateLocalRequest(id, {
      status: 'rejected',
      statusText: '已驳回',
      rejectionReason: reason,
      rejectedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    })
  )
}

function uploadAttachment(requestId, filePath) {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ id: `att-${Date.now()}`, originalName: '本地附件', fileType: 'file' })
  }
  return api.uploadFile({
    url: `/approvals/${requestId}/attachments`,
    filePath,
    name: 'file'
  })
}

function getAttachmentUrl(attachment) {
  if (!attachment || !attachment.downloadPath || !api.isApiEnabled()) {
    return ''
  }
  return api.buildApiUrl(attachment.downloadPath)
}

function getProofPdfUrl(request) {
  if (!request || !request.id || !api.isApiEnabled()) {
    return ''
  }
  return api.buildApiUrl(`/approvals/${request.id}/proof.pdf`)
}

function getDownloadHeader() {
  return api.getAuthHeader ? api.getAuthHeader() : {}
}

function saveLocalRequest(payload) {
  const user = profileService.getCurrentUser()
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const existing = readLocalRequests()
  const status = payload.submit ? 'pending' : payload.status || 'draft'
  const saved = {
    id: payload.id || `apr-local-${Date.now()}`,
    requestNo: payload.requestNo || `${payload.requestType === 'seal' ? 'SEAL' : 'PROOF'}-${Date.now()}`,
    requestType: payload.requestType,
    requestTypeText: payload.requestType === 'seal' ? '盖章申请' : '证明开具',
    title: payload.title,
    purpose: payload.purpose,
    description: payload.description,
    confidentialDescription: payload.confidentialDescription,
    status,
    statusText: status === 'pending' ? '待审批' : status === 'rejected' ? '已驳回' : '草稿',
    currentStepText: status === 'pending' ? '辅导员审批' : '待提交',
    studentNo: user.studentNo,
    studentName: user.name,
    className: user.className,
    major: user.major,
    updatedAt: now,
    submittedAt: payload.submit ? now : '',
    previewContent:
      payload.requestType === 'proof'
        ? `${user.name}（学号：${user.studentNo}）因“${payload.purpose}”申请开具证明。`
        : '',
    rejectionReason: status === 'pending' ? '' : payload.rejectionReason || ''
  }
  writeLocalRequests([saved].concat(existing.filter((item) => String(item.id) !== String(saved.id))))
  return saved
}

function updateLocalRequest(id, patch) {
  const existing = readLocalRequests()
  let saved = null
  const next = existing.map((item) => {
    if (String(item.id) !== String(id)) {
      return item
    }
    saved = {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    }
    return saved
  })
  writeLocalRequests(next)
  return saved || { id, ...patch }
}

module.exports = {
  fetchMyRequests,
  fetchManagedRequests,
  fetchRequestDetail,
  saveRequest,
  submitRequest,
  withdrawRequest,
  approveRequest,
  rejectRequest,
  uploadAttachment,
  getAttachmentUrl,
  getProofPdfUrl,
  getDownloadHeader
}
