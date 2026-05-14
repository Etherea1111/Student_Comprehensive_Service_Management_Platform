const env = require('../config/env')

function isApiEnabled() {
  return Boolean(env.apiBaseUrl)
}

function getToken() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return ''
  }
  return wx.getStorageSync(env.tokenStorageKey) || ''
}

function setToken(token) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(env.tokenStorageKey, token)
}

function clearToken() {
  if (typeof wx === 'undefined' || !wx.removeStorageSync) {
    return
  }
  wx.removeStorageSync(env.tokenStorageKey)
}

function request(options) {
  if (!isApiEnabled()) {
    return Promise.reject(new Error('API is not configured'))
  }

  const token = getToken()
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${env.apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        reject(new Error((res.data && res.data.error && res.data.error.message) || 'Request failed'))
      },
      fail: reject
    })
  })
}

module.exports = {
  isApiEnabled,
  request,
  getToken,
  setToken,
  clearToken
}
