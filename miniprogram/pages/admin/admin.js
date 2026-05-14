const adminService = require('../../services/adminService')
const profileService = require('../../services/profileService')
const knowledgeService = require('../../services/knowledgeService')
const authGuard = require('../../utils/authGuard')

const emptyDraftForm = {
  title: '',
  category: '',
  tagsText: '',
  answer: '',
  officialLink: ''
}

Page({
  data: {
    dashboard: {
      user: {},
      canManage: false,
      metrics: []
    },
    roleName: '',
    uploadPolicy: {},
    manageTagClass: 'neutral',
    manageStatusText: '只读',
    auditRequiredText: '',
    logs: [],
    futureModules: [],
    draftForm: emptyDraftForm,
    selectedFile: null,
    selectedFileName: '未选择文件',
    drafts: []
  },

  onLoad() {
    if (!authGuard.ensureLoggedIn()) {
      return
    }
    Promise.all([
      adminService.fetchDashboard(),
      adminService.fetchUploadPolicy(),
      adminService.fetchOperationLogs()
    ]).then(([dashboard, uploadPolicy, logs]) => {
      this.setData({
        dashboard,
        roleName: profileService.getRoleName(dashboard.user.role),
        manageTagClass: dashboard.canManage ? 'success' : 'neutral',
        manageStatusText: dashboard.canManage ? '可维护' : '只读',
        uploadPolicy: {
          ...uploadPolicy,
          allowedTypesText: uploadPolicy.allowedTypes.join(' / ')
        },
        auditRequiredText: uploadPolicy.auditRequired ? '需要复核' : '无需复核',
        logs,
        futureModules: adminService.getFutureModules(),
        drafts: knowledgeService.getKnowledgeDrafts()
      })
    })
  },

  onDraftInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      draftForm: {
        ...this.data.draftForm,
        [field]: event.detail.value
      }
    })
  },

  chooseDraftFile() {
    if (!wx.chooseMessageFile) {
      wx.showToast({
        title: '当前端暂不支持文件选择',
        icon: 'none'
      })
      return
    }
    const maxBytes = this.data.uploadPolicy.maxSizeMB * 1024 * 1024
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: this.data.uploadPolicy.allowedTypes,
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) {
          return
        }
        if (file.size > maxBytes) {
          wx.showToast({
            title: `文件不能超过 ${this.data.uploadPolicy.maxSizeMB}MB`,
            icon: 'none'
          })
          return
        }
        this.setData({
          selectedFile: file,
          selectedFileName: file.name || '已选择文件'
        })
      }
    })
  },

  submitDraft() {
    const form = this.data.draftForm
    if (!form.title || !form.category || !form.answer) {
      wx.showToast({
        title: '请填写标题、分类和答复',
        icon: 'none'
      })
      return
    }

    knowledgeService.addKnowledgeDraft({
      title: form.title,
      category: form.category,
      tags: form.tagsText
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
      answer: form.answer,
      officialLink: form.officialLink,
      owner: this.data.dashboard.user.name,
      fileName: this.data.selectedFileName
    })

    this.setData({
      draftForm: { ...emptyDraftForm },
      selectedFile: null,
      selectedFileName: '未选择文件',
      drafts: knowledgeService.getKnowledgeDrafts()
    })
    wx.showToast({
      title: '已生成草稿',
      icon: 'success'
    })
  }
})
