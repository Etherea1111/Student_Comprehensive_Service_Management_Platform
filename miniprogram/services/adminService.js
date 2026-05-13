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
    allowedTypes: ['doc', 'docx', 'xls', 'xlsx', 'pdf'],
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
  return futureModules
}

module.exports = {
  getDashboard,
  fetchDashboard,
  getOperationLogs,
  fetchOperationLogs,
  getUploadPolicy,
  fetchUploadPolicy,
  getFutureModules
}
