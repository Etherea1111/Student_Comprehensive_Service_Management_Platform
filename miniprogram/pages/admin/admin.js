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

const importTasks = [
  {
    key: 'students',
    title: '学生信息导入',
    desc: '按学号批量新增或更新学生基础信息，并自动生成学号账号。',
    permission: 'import_students',
    permissionText: '需要 import_students 权限',
    templateName: 'students_template.csv'
  },
  {
    key: 'processProgress',
    title: '党团进度导入',
    desc: '由负责老师在一次活动后批量更新入党/入团个人进度。',
    permission: 'manage_process',
    permissionText: '需要 manage_process 权限',
    templateName: 'process_progress_template.csv'
  },
  {
    key: 'quiz',
    title: '理论自测题库导入',
    desc: '批量导入官方题库，导入后可按题目状态发布使用。',
    permission: 'import_quiz',
    permissionText: '需要 import_quiz 权限',
    templateName: 'quiz_questions_template.csv'
  }
]

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
    importTasks: [],
    draftForm: emptyDraftForm,
    selectedFile: null,
    selectedFileName: '未选择文件',
    importResult: null,
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
        importTasks: this.buildImportTasks(dashboard.user.permissions || []),
        drafts: knowledgeService.getKnowledgeDrafts()
      })
    })
  },

  buildImportTasks(permissions) {
    const allowAll = permissions.indexOf('manage_all') >= 0
    return importTasks.map((item) => {
      const enabled = allowAll || permissions.indexOf(item.permission) >= 0
      return {
        ...item,
        disabled: !enabled,
        tagText: enabled ? '可操作' : '无权限',
        tagClass: enabled ? 'success' : 'neutral'
      }
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

  chooseImportFile(event) {
    const kind = event.currentTarget.dataset.kind
    const task = this.data.importTasks.find((item) => item.key === kind)
    if (!task || task.disabled) {
      wx.showToast({
        title: task ? task.permissionText : '无权操作',
        icon: 'none'
      })
      return
    }
    if (!adminService.uploadImportFile) {
      wx.showToast({
        title: '导入服务不可用',
        icon: 'none'
      })
      return
    }
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
      extension: ['xls', 'xlsx', 'csv'],
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
        this.confirmImport(task, file)
      }
    })
  },

  confirmImport(task, file) {
    wx.showModal({
      title: '确认导入',
      content: `将上传 ${file.name || '所选文件'}，系统会先校验格式再写入数据库。`,
      confirmText: '开始导入',
      success: (res) => {
        if (res.confirm) {
          this.uploadImport(task, file)
        }
      }
    })
  },

  uploadImport(task, file) {
    wx.showLoading({
      title: '导入中'
    })
    adminService
      .uploadImportFile(task.key, file.path || file.tempFilePath, false)
      .then((result) => {
        wx.hideLoading()
        this.setData({
          importResult: {
            title: task.title,
            fileName: file.name || '已上传文件',
            total: result.total || 0,
            imported: result.imported || 0,
            errorCount: result.errors ? result.errors.length : 0,
            errors: (result.errors || []).slice(0, 5)
          }
        })
        wx.showToast({
          title: result.errors && result.errors.length ? '校验未通过' : '导入完成',
          icon: result.errors && result.errors.length ? 'none' : 'success'
        })
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '导入失败',
          icon: 'none'
        })
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
