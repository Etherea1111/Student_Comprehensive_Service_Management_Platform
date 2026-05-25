const authService = require('../../services/authService')
const profileService = require('../../services/profileService')

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  },

  onLoad() {
    profileService.fetchCurrentUser().then((user) => {
      if (user.canChangePassword === false) {
        wx.showToast({ title: '该账号不支持修改密码', icon: 'none' })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/home/home' })
        }, 600)
      }
    })
  },

  onOldPasswordInput(event) {
    this.setData({ oldPassword: event.detail.value })
  },

  onNewPasswordInput(event) {
    this.setData({ newPassword: event.detail.value })
  },

  onConfirmPasswordInput(event) {
    this.setData({ confirmPassword: event.detail.value })
  },

  submitChange() {
    if (!this.data.oldPassword || !this.data.newPassword) {
      wx.showToast({ title: '请填写完整密码信息', icon: 'none' })
      return
    }
    if (this.data.newPassword.length < 8) {
      wx.showToast({ title: '新密码至少 8 位', icon: 'none' })
      return
    }
    if (this.data.newPassword !== this.data.confirmPassword) {
      wx.showToast({ title: '两次新密码不一致', icon: 'none' })
      return
    }

    wx.showLoading({ title: '正在修改' })
    authService
      .changePassword({
        oldPassword: this.data.oldPassword,
        newPassword: this.data.newPassword
      })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '修改成功', icon: 'success' })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/home/home' })
        }, 600)
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '修改失败',
          icon: 'none'
        })
      })
  }
})
