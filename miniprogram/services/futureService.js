function notImplemented(moduleName) {
  return {
    moduleName,
    status: 'reserved',
    message: '接口已预留，后续接入后台服务后实现。'
  }
}

function getNewsFeeds() {
  return {
    moduleName: '信息集成与精准推送',
    status: 'implemented',
    message: '已接入公告与站内消息服务。'
  }
}

function getApprovalRequests() {
  return {
    moduleName: '电子证明与审批',
    status: 'implemented',
    message: '已接入证明/盖章申请与审批服务。'
  }
}

function getAcademicWarnings() {
  return notImplemented('学业分析与预警')
}

module.exports = {
  getNewsFeeds,
  getApprovalRequests,
  getAcademicWarnings
}
