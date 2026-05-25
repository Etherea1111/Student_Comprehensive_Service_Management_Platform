const profileService = require('../../services/profileService')
const authService = require('../../services/authService')
const authGuard = require('../../utils/authGuard')

Page({
  data: {
    user: {},
    roleName: '',
    avatarText: '',
    adminAccountText: '',
    canEnterAdmin: false,
    canChangePassword: true,
    permissionItems: [],
    sensitiveVisibleText: ''
  },

  onLoad() {
    if (!authGuard.ensureLoggedIn()) {
      return
    }
    profileService.fetchCurrentUser().then((user) => {
      const permissions = user.permissions || []
      this.setData({
        user,
        roleName: profileService.getRoleName(user.role),
        avatarText: user.name ? user.name.slice(0, 1) : '我',
        adminAccountText: user.isAdminAccount ? '已绑定' : '已实名',
        sensitiveVisibleText:
          permissions.indexOf('read_sensitive') >= 0 || permissions.indexOf('manage_all') >= 0
            ? '可按权限查看'
            : '默认隐藏',
        permissionItems: this.buildPermissionItems(permissions),
        canEnterAdmin:
          permissions.indexOf('manage_public_content') >= 0 ||
          permissions.indexOf('view_operation_records') >= 0 ||
          permissions.indexOf('manage_all') >= 0,
        canChangePassword: user.canChangePassword !== false
      })
    })
  },

  buildPermissionItems(permissions) {
    const allowAll = permissions.indexOf('manage_all') >= 0
    const permissionMap = [
      { key: 'read_public', label: '公开政策查询' },
      { key: 'read_own_progress', label: '个人党团进度' },
      { key: 'manage_public_content', label: '知识库与模板维护' },
      { key: 'audit_content', label: '老师复核发布' },
      { key: 'manage_process', label: '流程与进度维护' },
      { key: 'approve_requests', label: '证明与盖章审批' },
      { key: 'read_sensitive', label: '敏感档案查看' },
      { key: 'view_operation_records', label: '操作日志查看' }
    ]
    return permissionMap
      .filter((item) => allowAll || permissions.indexOf(item.key) >= 0)
      .map((item) => ({
        ...item,
        tagClass: item.key === 'read_sensitive' ? 'warn' : 'neutral'
      }))
  },

  goQa() {
    wx.switchTab({
      url: '/pages/qa/qa'
    })
  },

  goProcess() {
    wx.switchTab({
      url: '/pages/process/process'
    })
  },

  goAnnouncements() {
    wx.navigateTo({
      url: '/pages/announcements/announcements'
    })
  },

  goApprovals() {
    wx.navigateTo({
      url: '/pages/approvals/approvals'
    })
  },

  goAdmin() {
    wx.navigateTo({
      url: '/pages/admin/admin'
    })
  },

  goChangePassword() {
    wx.navigateTo({
      url: '/pages/change-password/change-password'
    })
  },

  logout() {
    authService.logout()
    wx.reLaunch({
      url: '/pages/login/login'
    })
  }
})
