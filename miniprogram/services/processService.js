const { partyStages, leagueStages, progressRecords } = require('../data/mockData')
const profileService = require('./profileService')
const api = require('./request')

function getStages(type) {
  return type === 'league' ? leagueStages : partyStages
}

function getProgress(type) {
  const user = profileService.getCurrentUser()
  const record = progressRecords[user.id] || {}
  return record[type] || null
}

function getStageIndex(stages, stageId) {
  return stages.findIndex((stage) => stage.id === stageId)
}

function getProcessOverview(type) {
  const stages = getStages(type)
  const progress = getProgress(type)
  const currentIndex = progress ? getStageIndex(stages, progress.currentStageId) : -1
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : null

  return {
    type,
    stages,
    progress,
    currentIndex,
    currentStage
  }
}

function fetchProcessOverview(type) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getProcessOverview(type))
  }
  return api
    .request({
      url: `/processes/${type}/me`
    })
    .catch(() => getProcessOverview(type))
}

function getReminder(type) {
  const overview = getProcessOverview(type)
  if (!overview.progress || !overview.currentStage) {
    return null
  }
  return {
    title: `${overview.currentStage.name}节点提醒`,
    date: overview.progress.nextDeadline,
    content: `请在 ${overview.progress.nextDeadline} 前核对阶段材料：${overview.currentStage.actions.join('、')}。`,
    advisor: overview.progress.advisor
  }
}

module.exports = {
  getStages,
  getProcessOverview,
  fetchProcessOverview,
  getReminder
}
