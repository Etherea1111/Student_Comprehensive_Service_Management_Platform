const profileService = require('../../services/profileService')

Page({
  data: {
    user: {},
    roleName: '',
    avatarText: '',
    adminAccountText: '',
    canEnterAdmin: false
  },

  onLoad() {
    profileService.fetchCurrentUser().then((user) => {
      const permissions = user.permissions || []
      this.setData({
        user,
        roleName: profileService.getRoleName(user.role),
        avatarText: user.name ? user.name.slice(0, 1) : '我',
        adminAccountText: user.isAdminAccount ? '已绑定' : '已实名',
        canEnterAdmin:
          permissions.indexOf('manage_public_content') >= 0 ||
          permissions.indexOf('view_operation_records') >= 0 ||
          permissions.indexOf('manage_all') >= 0
      })
    })
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

  goAdmin() {
    wx.navigateTo({
      url: '/pages/admin/admin'
    })
  }
})
