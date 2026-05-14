const profileService = require('../../services/profileService')
const processService = require('../../services/processService')
const adminService = require('../../services/adminService')
const authGuard = require('../../utils/authGuard')

Page({
  data: {
    user: {},
    roleName: '',
    partyReminder: null,
    futureModules: []
  },

  onLoad() {
    if (!authGuard.ensureLoggedIn()) {
      return
    }
    profileService.fetchCurrentUser().then((user) => {
      this.setData({
        user,
        roleName: profileService.getRoleName(user.role),
        futureModules: adminService.getFutureModules()
      })
    })
    processService.fetchProcessOverview('party').then((overview) => {
      this.setData({
        partyReminder: this.buildReminder(overview)
      })
    })
  },

  buildReminder(overview) {
    if (!overview.progress || !overview.currentStage) {
      return null
    }
    return {
      title: `${overview.currentStage.name}节点提醒`,
      date: overview.progress.nextDeadline,
      content: `请在 ${overview.progress.nextDeadline} 前核对阶段材料：${overview.currentStage.actions.join('、')}。`,
      advisor: overview.progress.advisor
    }
  },

  goQa() {
    wx.switchTab({
      url: '/pages/qa/qa'
    })
  },

  goProcess() {
    wx.switchTab({
      url: '/pages/process/process'
    })
  }
})
