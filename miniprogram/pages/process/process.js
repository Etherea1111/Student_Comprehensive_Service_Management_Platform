const processService = require('../../services/processService')
const format = require('../../utils/format')

Page({
  data: {
    activeType: 'party',
    partySegmentClass: 'active',
    leagueSegmentClass: '',
    stages: [],
    progress: null,
    currentIndex: -1,
    currentStage: null,
    reminder: null,
    progressPercent: '0%'
  },

  onLoad() {
    this.refreshProcess()
  },

  switchType(event) {
    this.setData({
      activeType: event.currentTarget.dataset.type
    })
    this.refreshProcess()
  },

  refreshProcess() {
    processService.fetchProcessOverview(this.data.activeType).then((overview) => {
    const denominator = Math.max(overview.stages.length - 1, 1)
    const progressValue = overview.currentIndex < 0 ? 0 : overview.currentIndex / denominator
    const completedActions =
      overview.progress && overview.progress.completedActionIds ? overview.progress.completedActionIds : []
    const stages = overview.stages.map((stage, index) => {
      let statusClass = ''
      if (index < overview.currentIndex) {
        statusClass = 'done'
      }
      if (index === overview.currentIndex) {
        statusClass = 'current'
      }
      return {
        ...stage,
        stepNo: index + 1,
        statusClass,
        actionItems: stage.actions.map((name) => ({
          name,
          doneClass: completedActions.indexOf(name) >= 0 ? 'done' : ''
        }))
      }
    })
    this.setData({
      partySegmentClass: this.data.activeType === 'party' ? 'active' : '',
      leagueSegmentClass: this.data.activeType === 'league' ? 'active' : '',
      stages,
      progress: overview.progress,
      currentIndex: overview.currentIndex,
      currentStage: overview.currentStage,
      reminder: this.buildReminder(overview),
      progressPercent: format.percent(progressValue)
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

  goQuiz() {
    wx.navigateTo({
      url: '/pages/quiz/quiz'
    })
  }
})
