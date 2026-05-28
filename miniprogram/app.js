const profileService = require('./services/profileService')
const authService = require('./services/authService')
const env = require('./config/env')

App({
  globalData: {
    user: null
  },

  onLaunch() {
    if (env.useCloud && typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.init(env.cloudEnvId ? { env: env.cloudEnvId } : {})
    }
    this.globalData.user = profileService.getCurrentUser()
    authService.tryAutoLogin().catch(() => {})
  }
})
