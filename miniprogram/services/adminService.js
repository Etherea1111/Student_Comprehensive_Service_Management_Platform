const { adminLogs, futureModules } = require('../data/mockData')
const profileService = require('./profileService')
const api = require('./request')

function getDashboard() {
  const canManage = profileService.hasPermission('manage_public_content')
  const user = profileService.getCurrentUser()
  return {
    user,
    canManage,
    metrics: [
      { label: '知识库条目', value: 5 },
      { label: '模板文件', value: 4 },
      { label: '流程配置', value: 2 },
      { label: '待复核内容', value: canManage ? 2 : 0 }
    ],
    logs: adminLogs
  }
}

function fetchDashboard() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getDashboard())
  }
  return api
    .request({
      url: '/admin/dashboard'
    })
    .catch(() => getDashboard())
}

function getOperationLogs() {
  if (!profileService.hasPermission('view_operation_records')) {
    return []
  }
  return adminLogs
}

function fetchOperationLogs() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getOperationLogs())
  }
  return api
    .request({
      url: '/admin/logs'
    })
    .then((result) => result.items || [])
    .catch(() => getOperationLogs())
}

function getUploadPolicy() {
  return {
    allowedTypes: ['doc', 'docx', 'xls', 'xlsx', 'csv', 'pdf', 'jpg', 'jpeg', 'png'],
    maxSizeMB: 30,
    auditRequired: true,
    ownerRule: '谁上传，谁维护；敏感资料按角色权限控制。'
  }
}

function fetchUploadPolicy() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getUploadPolicy())
  }
  return api
    .request({
      url: '/admin/upload-policy'
    })
    .catch(() => getUploadPolicy())
}

function getFutureModules() {
  return futureModules.filter((item) => item.id === 'academic')
}

function uploadImportFile(kind, filePath, preview) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }

  const endpointMap = {
    students: '/imports/students',
    processProgress: '/imports/process-progress',
    quiz: '/imports/quiz'
  }
  const endpoint = endpointMap[kind]
  if (!endpoint) {
    return Promise.reject(new Error('未知导入类型'))
  }

  return api.uploadFile({
    url: preview ? `${endpoint}/preview` : endpoint,
    filePath,
    name: 'file'
  })
}

function fetchAccounts(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve([])
  }
  return api
    .request({
      url: '/admin/accounts',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => [])
}

function saveAccount(payload) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }
  return api.request({
    url: '/admin/accounts',
    method: 'PUT',
    data: payload
  })
}

function disableAccount(id) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }
  return api.request({
    url: `/admin/accounts/${id}/disable`,
    method: 'POST'
  })
}

function getExportUrl(kind) {
  if (!api.isApiEnabled()) {
    return ''
  }
  const endpointMap = {
    students: '/exports/students.csv',
    processProgress: '/exports/process-progress.csv',
    knowledge: '/exports/knowledge.csv',
    templates: '/exports/templates.csv',
    approvals: '/exports/approvals.csv',
    workRecords: '/exports/work-records.csv',
    announcementDeliveries: '/exports/announcement-deliveries.csv'
  }
  return api.buildApiUrl(endpointMap[kind])
}

function getDownloadHeader() {
  return api.getAuthHeader ? api.getAuthHeader() : {}
}

module.exports = {
  getDashboard,
  fetchDashboard,
  getOperationLogs,
  fetchOperationLogs,
  getUploadPolicy,
  fetchUploadPolicy,
  getFutureModules,
  uploadImportFile,
  getExportUrl,
  getDownloadHeader,
  fetchAccounts,
  saveAccount,
  disableAccount
}
