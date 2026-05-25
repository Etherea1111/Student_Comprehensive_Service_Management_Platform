const api = require('./request')

const pendingBindingStorageKey = 'student_service_pending_binding'

function hasToken() {
  return Boolean(api.getToken())
}

function isBindingPending() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return false
  }
  return Boolean(wx.getStorageSync(pendingBindingStorageKey))
}

function setBindingPending(pending) {
  if (typeof wx === 'undefined' || !wx.setStorageSync || !wx.removeStorageSync) {
    return
  }
  if (pending) {
    wx.setStorageSync(pendingBindingStorageKey, '1')
    return
  }
  wx.removeStorageSync(pendingBindingStorageKey)
}

function tryAutoLogin() {
  if (hasToken()) {
    return Promise.resolve({ loggedIn: true })
  }
  return Promise.resolve({ loggedIn: false })
}


function loginWithWechat() {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('??????????'))
  }
  return new Promise((resolve, reject) => {
    wx.login({
      success: (loginResult) => {
        if (!loginResult.code) {
          reject(new Error('??????? code'))
          return
        }
        api
          .request({
            url: '/auth/wechat-login',
            method: 'POST',
            data: {
              code: loginResult.code
            }
          })
          .then((result) => {
            if (result.token) {
              api.setToken(result.token)
            }
            setBindingPending(Boolean(result.bindingRequired))
            resolve(result)
          })
          .catch(reject)
      },
      fail: reject
    })
  })
}

function loginWithPassword(payload) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }
  return api
    .request({
      url: '/auth/password-login',
      method: 'POST',
      data: payload
    })
    .then((result) => {
      if (result.token) {
        api.setToken(result.token)
      }
      setBindingPending(Boolean(result.bindingRequired))
      return result
    })
}

function registerAccount(payload) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }
  return api
    .request({
      url: '/auth/register',
      method: 'POST',
      data: payload
    })
    .then((result) => {
      if (result.token) {
        api.setToken(result.token)
      }
      setBindingPending(Boolean(result.bindingRequired))
      return result
    })
}

function bindStudent(payload) {
  return api
    .request({
      url: '/auth/bind-student',
      method: 'POST',
      data: payload
    })
    .then((result) => {
      if (result.token) {
        api.setToken(result.token)
      }
      setBindingPending(false)
      return result
    })
}

function changePassword(payload) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }
  return api.request({
    url: '/auth/change-password',
    method: 'POST',
    data: payload
  })
}

function logout() {
  api.clearToken()
  setBindingPending(false)
}

module.exports = {
  hasToken,
  isBindingPending,
  tryAutoLogin,
  loginWithWechat,
  loginWithPassword,
  registerAccount,
  bindStudent,
  changePassword,
  logout
}
