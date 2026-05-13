function notImplemented(moduleName) {
  return {
    moduleName,
    status: 'reserved',
    message: '接口已预留，后续接入后台服务后实现。'
  }
}

function getNewsFeeds() {
  return notImplemented('信息集成与精准推送')
}

function getApprovalRequests() {
  return notImplemented('电子证明与审批')
}

function getAcademicWarnings() {
  return notImplemented('学业分析与预警')
}

module.exports = {
  getNewsFeeds,
  getApprovalRequests,
  getAcademicWarnings
}
