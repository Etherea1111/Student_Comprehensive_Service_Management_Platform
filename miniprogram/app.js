const profileService = require('./services/profileService')
const authService = require('./services/authService')

App({
  globalData: {
    user: null
  },

  onLaunch() {
    this.globalData.user = profileService.getCurrentUser()
    authService.tryAutoLogin().catch(() => {})
  }
})
