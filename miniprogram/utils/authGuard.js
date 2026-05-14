const api = require('../services/request')
const authService = require('../services/authService')

function ensureLoggedIn() {
  if (!api.isApiEnabled()) {
    return true
  }
  if (authService.hasToken()) {
    return true
  }
  wx.reLaunch({ url: '/pages/login/login' })
  return false
}

module.exports = {
  ensureLoggedIn
}
