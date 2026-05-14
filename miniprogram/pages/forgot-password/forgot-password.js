const authService = require('../../services/authService')

Page({
  data: {
    studentNo: '',
    name: '',
    resetToken: '',
    serverResetToken: '',
    newPassword: ''
  },

  onStudentNoInput(event) {
    this.setData({ studentNo: event.detail.value })
  },

  onNameInput(event) {
    this.setData({ name: event.detail.value })
  },

  onNewPasswordInput(event) {
    this.setData({ newPassword: event.detail.value })
  },

  onResetTokenInput(event) {
    this.setData({ resetToken: event.detail.value })
  },

  requestReset() {
    if (!/^\d{10}$/.test(this.data.studentNo) || !this.data.name) {
      wx.showToast({ title: '请填写学号和姓名', icon: 'none' })
      return
    }

    wx.showLoading({ title: '正在提交' })
    authService
      .requestPasswordReset({
        studentNo: this.data.studentNo,
        name: this.data.name
      })
      .then((result) => {
        wx.hideLoading()
        this.setData({
          resetToken: result.resetToken || this.data.resetToken,
          serverResetToken: result.resetToken || ''
        })
        wx.showToast({ title: '申请已提交', icon: 'success' })
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '提交失败',
          icon: 'none'
        })
      })
  },

  confirmReset() {
    if (!this.data.resetToken) {
      wx.showToast({ title: '缺少重置凭证', icon: 'none' })
      return
    }
    if (this.data.newPassword.length < 8) {
      wx.showToast({ title: '新密码至少 8 位', icon: 'none' })
      return
    }

    wx.showLoading({ title: '正在重置' })
    authService
      .resetPassword({
        studentNo: this.data.studentNo,
        resetToken: this.data.resetToken,
        newPassword: this.data.newPassword
      })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '重置成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 600)
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '重置失败',
          icon: 'none'
        })
      })
  }
})
