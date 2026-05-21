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

function fetchManagedStudents(filters = {}) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getLocalManagedStudents(filters))
  }
  return api
    .request({
      url: '/profile/students',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => getLocalManagedStudents(filters))
}

function getLocalManagedStudents(filters = {}) {
  const user = getCurrentUser()
  const keyword = String(filters.keyword || '').trim()
  const canReadSensitive =
    user.permissions.indexOf('read_sensitive') >= 0 || user.permissions.indexOf('manage_all') >= 0
  const row = {
    studentNo: user.studentNo,
    name: user.name,
    college: user.college,
    major: user.major,
    className: user.className,
    grade: user.grade,
    politicalStatus: user.politicalStatus,
    partyStage: user.partyStage,
    leagueStage: user.leagueStage,
    ethnicity: '汉族',
    advisor: canReadSensitive ? '王老师' : '已隐藏',
    studentStatus: '在读',
    isAlumni: false,
    awards: '演示获奖记录',
    remark: canReadSensitive ? '演示敏感备注' : '已隐藏',
    role: user.role,
    phone: canReadSensitive ? '13800000000' : '138****0000',
    idCard: canReadSensitive ? '110101200001010011' : '110101********0011',
    birthplace: canReadSensitive ? '北京市' : '已隐藏',
    householdRegister: canReadSensitive ? '北京市海淀区' : '已隐藏',
    sensitiveVisible: canReadSensitive,
    updatedAt: '2026-04-01 10:00'
  }
  if (!keyword) {
    return [row]
  }
  const haystack = [row.studentNo, row.name, row.className, row.major].join(' ')
  return haystack.indexOf(keyword) >= 0 ? [row] : []
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
  fetchManagedStudents,
  getRoleName
}
