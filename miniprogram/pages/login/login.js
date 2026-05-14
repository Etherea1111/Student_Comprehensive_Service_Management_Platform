const authService = require('../../services/authService')
const api = require('../../services/request')

Page({
  data: {
    activeMode: 'wechat',
    wechatTabClass: 'active',
    passwordTabClass: '',
    showWechatLogin: true,
    showPasswordLogin: false,
    showDemoEntry: false,
    studentNo: '',
    password: ''
  },

  onLoad() {
    if (authService.hasToken()) {
      this.goHome()
      return
    }
    this.setData({
      showDemoEntry: !api.isApiEnabled()
    })
  },

  switchMode(event) {
    const activeMode = event.currentTarget.dataset.mode
    this.setData({
      activeMode,
      wechatTabClass: activeMode === 'wechat' ? 'active' : '',
      passwordTabClass: activeMode === 'password' ? 'active' : '',
      showWechatLogin: activeMode === 'wechat',
      showPasswordLogin: activeMode === 'password'
    })
  },

  onStudentNoInput(event) {
    this.setData({
      studentNo: event.detail.value
    })
  },

  onPasswordInput(event) {
    this.setData({
      password: event.detail.value
    })
  },

  handleWechatLogin() {
    wx.showLoading({ title: '正在登录' })
    authService
      .loginWithWechat()
      .then((result) => {
        wx.hideLoading()
        if (result.bindingRequired) {
          wx.navigateTo({
            url: '/pages/bind/bind'
          })
          return
        }
        this.goHome()
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '微信登录失败',
          icon: 'none'
        })
      })
  },

  handlePasswordLogin() {
    if (!/^\d{10}$/.test(this.data.studentNo)) {
      wx.showToast({ title: '请输入 10 位学号', icon: 'none' })
      return
    }
    if (!this.data.password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在登录' })
    authService
      .loginWithPassword({
        studentNo: this.data.studentNo,
        password: this.data.password
      })
      .then((result) => {
        wx.hideLoading()
        if (result.mustChangePassword) {
          wx.navigateTo({ url: '/pages/change-password/change-password?initial=1' })
          return
        }
        this.goHome()
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '登录失败',
          icon: 'none'
        })
      })
  },

  goForgotPassword() {
    wx.navigateTo({ url: '/pages/forgot-password/forgot-password' })
  },

  goChangePassword() {
    wx.navigateTo({ url: '/pages/change-password/change-password' })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  },

  enterDemo() {
    this.goHome()
  }
})
