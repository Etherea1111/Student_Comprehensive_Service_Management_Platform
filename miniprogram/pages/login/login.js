const authService = require('../../services/authService')
const api = require('../../services/request')

Page({
  data: {
    activeMode: 'password',
    passwordTabClass: 'active',
    registerTabClass: '',
    showPasswordLogin: true,
    showRegister: false,
    showDemoEntry: false,
    accountName: '',
    password: '',
    registerAccountName: '',
    registerPassword: '',
    confirmPassword: '',
    displayName: ''
  },

  onLoad() {
    if (authService.hasToken()) {
      if (authService.isBindingPending()) {
        wx.reLaunch({ url: '/pages/bind/bind' })
        return
      }
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
      passwordTabClass: activeMode === 'password' ? 'active' : '',
      registerTabClass: activeMode === 'register' ? 'active' : '',
      showPasswordLogin: activeMode === 'password',
      showRegister: activeMode === 'register'
    })
  },

  onAccountNameInput(event) {
    this.setData({
      accountName: event.detail.value
    })
  },

  onPasswordInput(event) {
    this.setData({
      password: event.detail.value
    })
  },

  onRegisterAccountNameInput(event) {
    this.setData({ registerAccountName: event.detail.value })
  },

  onRegisterPasswordInput(event) {
    this.setData({ registerPassword: event.detail.value })
  },

  onConfirmPasswordInput(event) {
    this.setData({ confirmPassword: event.detail.value })
  },

  onDisplayNameInput(event) {
    this.setData({ displayName: event.detail.value })
  },

  handlePasswordLogin() {
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(this.data.accountName)) {
      wx.showToast({ title: '请输入 4-32 位账号', icon: 'none' })
      return
    }
    if (!this.data.password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在登录' })
    authService
      .loginWithPassword({
        accountName: this.data.accountName,
        password: this.data.password
      })
      .then((result) => {
        wx.hideLoading()
        if (result.bindingRequired) {
          wx.reLaunch({ url: '/pages/bind/bind' })
          return
        }
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

  handleRegister() {
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(this.data.registerAccountName)) {
      wx.showToast({ title: '账号需为 4-32 位字母、数字或下划线', icon: 'none' })
      return
    }
    if (this.data.registerPassword.length < 8 || this.data.registerPassword.length > 64) {
      wx.showToast({ title: '密码需为 8-64 位', icon: 'none' })
      return
    }
    if (this.data.registerPassword !== this.data.confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在注册' })
    authService
      .registerAccount({
        accountName: this.data.registerAccountName,
        password: this.data.registerPassword,
        displayName: this.data.displayName
      })
      .then(() => {
        wx.hideLoading()
        wx.reLaunch({ url: '/pages/bind/bind' })
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '注册失败',
          icon: 'none'
        })
      })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  },

  enterDemo() {
    this.goHome()
  }
})
