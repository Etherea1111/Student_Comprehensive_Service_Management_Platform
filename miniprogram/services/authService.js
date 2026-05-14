const api = require('./request')

function hasToken() {
  return Boolean(api.getToken())
}

function tryAutoLogin() {
  if (hasToken()) {
    return Promise.resolve({ loggedIn: true })
  }
  return Promise.resolve({ loggedIn: false })
}

function loginWithWechat() {
  if (!api.isApiEnabled()) {
    return Promise.resolve({ apiEnabled: false })
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success: (loginRes) => {
        api
          .request({
            url: '/auth/wechat-login',
            method: 'POST',
            data: {
              code: loginRes.code
            }
          })
          .then((result) => {
            if (result.token) {
              api.setToken(result.token)
            }
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

function requestPasswordReset(payload) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }
  return api.request({
    url: '/auth/password-reset/request',
    method: 'POST',
    data: payload
  })
}

function resetPassword(payload) {
  if (!api.isApiEnabled()) {
    return Promise.reject(new Error('请先配置后端服务地址'))
  }
  return api.request({
    url: '/auth/password-reset/confirm',
    method: 'POST',
    data: payload
  })
}

function logout() {
  api.clearToken()
}

module.exports = {
  hasToken,
  tryAutoLogin,
  loginWithWechat,
  loginWithPassword,
  bindStudent,
  changePassword,
  requestPasswordReset,
  resetPassword,
  logout
}
