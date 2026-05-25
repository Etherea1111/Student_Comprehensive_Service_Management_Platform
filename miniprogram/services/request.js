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

function uploadFile(options) {
  if (!isApiEnabled()) {
    return Promise.reject(new Error('API is not configured'))
  }

  const token = getToken()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${env.apiBaseUrl}${options.url}`,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success: (res) => {
        let data = {}
        try {
          data = res.data ? JSON.parse(res.data) : {}
        } catch (error) {
          reject(new Error('Upload response is not valid JSON'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
          return
        }
        reject(new Error((data.error && data.error.message) || 'Upload failed'))
      },
      fail: reject
    })
  })
}

function buildApiUrl(path) {
  if (!isApiEnabled() || !path) {
    return ''
  }
  return `${env.apiBaseUrl}${path}`
}

function getAuthHeader() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

module.exports = {
  isApiEnabled,
  buildApiUrl,
  getAuthHeader,
  request,
  uploadFile,
  getToken,
  setToken,
  clearToken
}
