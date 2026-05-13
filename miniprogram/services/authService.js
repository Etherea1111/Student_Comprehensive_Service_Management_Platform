const api = require('./request')

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

module.exports = {
  loginWithWechat,
  bindStudent
}
