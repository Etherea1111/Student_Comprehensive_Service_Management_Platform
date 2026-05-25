const api = require('../services/request')
const authService = require('../services/authService')

function ensureLoggedIn() {
  if (!api.isApiEnabled()) {
    return true
  }
  if (authService.hasToken() && !authService.isBindingPending()) {
    return true
  }
  if (authService.hasToken() && authService.isBindingPending()) {
    wx.reLaunch({ url: '/pages/bind/bind' })
    return false
  }
  wx.reLaunch({ url: '/pages/login/login' })
  return false
}

module.exports = {
  ensureLoggedIn
}
