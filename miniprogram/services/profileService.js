const { currentUser, rolePermissions } = require('../data/mockData')
const api = require('./request')

function getCurrentUser() {
  return {
    ...currentUser,
    permissions: rolePermissions[currentUser.role] || []
  }
}

function fetchCurrentUser() {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getCurrentUser())
  }
  return api
    .request({
      url: '/profile/me'
    })
    .catch(() => getCurrentUser())
}

function hasPermission(permission) {
  const user = getCurrentUser()
  return user.permissions.indexOf(permission) >= 0 || user.permissions.indexOf('manage_all') >= 0
}

function getRoleName(role) {
  const roleMap = {
    student: '普通学生',
    class_leader: '班团骨干',
    counselor: '班主任/辅导员',
    college_leader: '学院领导',
    super_admin: '超级管理员'
  }
  return roleMap[role] || '未识别角色'
}

module.exports = {
  getCurrentUser,
  fetchCurrentUser,
  hasPermission,
  getRoleName
}
