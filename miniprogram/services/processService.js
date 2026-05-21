const { partyStages, leagueStages, progressRecords } = require('../data/mockData')
const profileService = require('./profileService')
const api = require('./request')

const LOCAL_STAGES_KEY = 'managed_process_stages'
const LOCAL_PROGRESS_KEY = 'managed_process_progress'

function readLocalItems(key) {
  if (typeof wx === 'undefined' || !wx.getStorageSync) {
    return []
  }
  return wx.getStorageSync(key) || []
}

function writeLocalItems(key, items) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) {
    return
  }
  wx.setStorageSync(key, items)
}

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

function fetchManagedStages(type) {
  if (!api.isApiEnabled()) {
    return Promise.resolve(getLocalManagedStages(type))
  }
  return api
    .request({
      url: '/processes/stages/manage',
      data: {
        type
      }
    })
    .then((result) => result.items || [])
    .catch(() => getLocalManagedStages(type))
}

function getLocalManagedStages(type) {
  const localStages = readLocalItems(LOCAL_STAGES_KEY).filter((stage) => stage.processType === type)
  const localCodes = localStages.map((stage) => stage.stageCode)
  const baseStages = getStages(type)
    .map((stage, index) => ({
      ...stage,
      processType: type,
      stageCode: stage.id,
      sortOrder: index + 1,
      enabled: true
    }))
    .filter((stage) => localCodes.indexOf(stage.stageCode) < 0)
  return localStages.concat(baseStages).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
}

function saveProcessStage(payload) {
  if (!api.isApiEnabled()) {
    const localStages = readLocalItems(LOCAL_STAGES_KEY)
    const saved = {
      ...payload,
      id: `${payload.processType}-${payload.stageCode}`,
      idForView: payload.stageCode,
      stageCode: payload.stageCode,
      processType: payload.processType,
      enabled: true
    }
    const nextStages = localStages.filter(
      (stage) => !(stage.processType === saved.processType && stage.stageCode === saved.stageCode)
    )
    nextStages.unshift(saved)
    writeLocalItems(LOCAL_STAGES_KEY, nextStages)
    return Promise.resolve(saved)
  }
  return api.request({
    url: '/processes/stages',
    method: 'PUT',
    data: payload
  })
}

function fetchManagedProgress(filters = {}) {
  if (!api.isApiEnabled()) {
    const localProgress = readLocalItems(LOCAL_PROGRESS_KEY)
    if (localProgress.length) {
      const keyword = String(filters.keyword || '').trim()
      return Promise.resolve(
        localProgress.filter((item) => {
          const typeMatched = !filters.processType || item.processType === filters.processType
          if (!keyword) {
            return typeMatched
          }
          const haystack = [item.studentNo, item.name, item.className, item.major].join(' ')
          return typeMatched && haystack.indexOf(keyword) >= 0
        })
      )
    }
    const user = profileService.getCurrentUser()
    const type = filters.processType || 'party'
    const progress = getProgress(type)
    return Promise.resolve(
      progress
        ? [
            {
              studentNo: user.studentNo,
              name: user.name,
              className: user.className,
              grade: user.grade,
              major: user.major,
              processType: type,
              currentStageCode: progress.currentStageId,
              currentStageName: (getStages(type).find((stage) => stage.id === progress.currentStageId) || {}).name,
              startedAt: progress.startedAt,
              completedActions: progress.completedActionIds || [],
              nextDeadline: progress.nextDeadline,
              advisor: progress.advisor
            }
          ]
        : []
    )
  }
  return api
    .request({
      url: '/processes/progress/manage',
      data: filters
    })
    .then((result) => result.items || [])
    .catch(() => [])
}

function saveStudentProgress(payload) {
  if (!api.isApiEnabled()) {
    const user = profileService.getCurrentUser()
    const stages = getStages(payload.processType)
    const currentStage = stages.find((stage) => stage.id === payload.currentStageCode)
    const localProgress = readLocalItems(LOCAL_PROGRESS_KEY)
    const saved = {
      ...payload,
      name: user.name,
      className: user.className,
      grade: user.grade,
      major: user.major,
      currentStageName: currentStage ? currentStage.name : payload.currentStageCode
    }
    const nextProgress = localProgress.filter(
      (item) => !(item.studentNo === saved.studentNo && item.processType === saved.processType)
    )
    nextProgress.unshift(saved)
    writeLocalItems(LOCAL_PROGRESS_KEY, nextProgress)
    return Promise.resolve(saved)
  }
  return api.request({
    url: '/processes/progress',
    method: 'PUT',
    data: payload
  })
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
  fetchManagedStages,
  saveProcessStage,
  fetchManagedProgress,
  saveStudentProgress,
  getReminder
}
