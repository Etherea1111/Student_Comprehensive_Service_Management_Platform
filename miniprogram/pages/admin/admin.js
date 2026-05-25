const adminService = require('../../services/adminService')
const profileService = require('../../services/profileService')
const knowledgeService = require('../../services/knowledgeService')
const processService = require('../../services/processService')
const announcementService = require('../../services/announcementService')
const approvalService = require('../../services/approvalService')
const authGuard = require('../../utils/authGuard')

const emptyDraftForm = {
  title: '',
  category: '',
  tagsText: '',
  keywordsText: '',
  answer: '',
  officialLink: '',
  sensitiveHint: ''
}

const emptyStageForm = {
  processType: 'party',
  stageCode: '',
  name: '',
  shortName: '',
  description: '',
  actionsText: '',
  reminderDays: '',
  sortOrder: ''
}

const emptyProgressForm = {
  studentNo: '',
  processType: 'party',
  currentStageCode: '',
  startedAt: '',
  nextDeadline: '',
  advisor: '',
  completedActionsText: ''
}

const emptyTemplateForm = {
  id: '',
  name: '',
  category: '',
  fileType: 'docx',
  size: '',
  url: '',
  description: ''
}

const emptyAnnouncementForm = {
  id: '',
  title: '',
  summary: '',
  content: '',
  sourceName: '',
  sourceUrl: '',
  priority: 'normal',
  tagsText: '',
  targetsText: 'all:全部',
  publishAt: '',
  expireAt: ''
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
    drafts: [],
    managedKnowledge: [],
    stageForm: emptyStageForm,
    processTypeOptions: [
      { label: '入党', value: 'party' },
      { label: '入团', value: 'league' }
    ],
    activeManageProcessType: 'party',
    managedStages: [],
    progressKeyword: '',
    managedProgress: [],
    progressForm: emptyProgressForm,
    studentKeyword: '',
    managedStudents: [],
    canAuditContent: false,
    canManageProcess: false,
    canApproveRequests: false,
    canReadSensitive: false,
    templateForm: emptyTemplateForm,
    managedTemplates: [],
    announcementForm: emptyAnnouncementForm,
    managedAnnouncements: [],
    approvalKeyword: '',
    managedApprovals: [],
    approvalComment: ''
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
        drafts: knowledgeService.getKnowledgeDrafts(),
        canAuditContent: this.hasDashboardPermission(dashboard.user, 'audit_content'),
        canManageProcess: this.hasDashboardPermission(dashboard.user, 'manage_process'),
        canApproveRequests: this.hasDashboardPermission(dashboard.user, 'approve_requests'),
        canReadSensitive: this.hasDashboardPermission(dashboard.user, 'read_sensitive')
      })
      this.refreshManagedKnowledge()
      this.refreshManagedTemplates()
      this.refreshManagedStages()
      this.refreshManagedProgress()
      this.refreshManagedStudents()
      this.refreshManagedAnnouncements()
      this.refreshManagedApprovals()
    })
  },

  hasDashboardPermission(user, permission) {
    const permissions = (user && user.permissions) || []
    return permissions.indexOf(permission) >= 0 || permissions.indexOf('manage_all') >= 0
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

  onStageInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      stageForm: {
        ...this.data.stageForm,
        [field]: event.detail.value
      }
    })
  },

  onProgressInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      progressForm: {
        ...this.data.progressForm,
        [field]: event.detail.value
      }
    })
  },

  onTemplateInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      templateForm: {
        ...this.data.templateForm,
        [field]: event.detail.value
      }
    })
  },

  onAnnouncementInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      announcementForm: {
        ...this.data.announcementForm,
        [field]: event.detail.value
      }
    })
  },

  onApprovalKeywordInput(event) {
    this.setData({
      approvalKeyword: event.detail.value
    })
  },

  onProgressKeywordInput(event) {
    this.setData({
      progressKeyword: event.detail.value
    })
  },

  onStudentKeywordInput(event) {
    this.setData({
      studentKeyword: event.detail.value
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

    knowledgeService
      .addKnowledgeDraft({
        title: form.title,
        category: form.category,
        tags: form.tagsText
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean),
        keywords: form.keywordsText
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean),
        answer: form.answer,
        officialLink: form.officialLink,
        sensitiveHint: form.sensitiveHint,
        owner: this.data.dashboard.user.name,
        fileName: this.data.selectedFileName
      })
      .then(() => {
        this.setData({
          draftForm: { ...emptyDraftForm },
          selectedFile: null,
          selectedFileName: '未选择文件',
          drafts: knowledgeService.getKnowledgeDrafts()
        })
        this.refreshManagedKnowledge()
        wx.showToast({
          title: '已生成草稿',
          icon: 'success'
        })
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || '草稿提交失败',
          icon: 'none'
        })
      })
  },

  refreshManagedKnowledge() {
    knowledgeService.fetchManagedKnowledge({ status: '全部' }).then((items) => {
      this.setData({
        managedKnowledge: items.map((item) => ({
          ...item,
          tagsText: (item.tags || []).join('、'),
          statusClass: item.status === 'published' ? 'success' : item.status === 'rejected' ? 'warn' : 'neutral',
          canPublish: item.status === 'draft' && this.data.canAuditContent,
          canReject: item.status === 'draft' && this.data.canAuditContent,
          canArchive: item.status === 'published' && this.data.dashboard.canManage
        }))
      })
    })
  },

  publishKnowledge(event) {
    const id = event.currentTarget.dataset.id
    knowledgeService.publishKnowledgeDraft(id).then(() => {
      wx.showToast({ title: '已发布', icon: 'success' })
      this.refreshManagedKnowledge()
    })
  },

  rejectKnowledge(event) {
    const id = event.currentTarget.dataset.id
    knowledgeService.rejectKnowledgeDraft(id).then(() => {
      wx.showToast({ title: '已退回', icon: 'success' })
      this.refreshManagedKnowledge()
    })
  },

  archiveKnowledge(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '确认归档',
      content: '归档后学生端不再展示该条标准答复。',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        knowledgeService.archiveKnowledgeItem(id).then(() => {
          wx.showToast({ title: '已归档', icon: 'success' })
          this.refreshManagedKnowledge()
        })
      }
    })
  },

  refreshManagedTemplates() {
    knowledgeService.fetchManagedTemplates({ status: '全部' }).then((items) => {
      this.setData({
        managedTemplates: items.map((item) => ({
          ...item,
          statusClass: item.status === 'published' ? 'success' : 'neutral',
          canArchive: item.status === 'published' && this.data.dashboard.canManage
        }))
      })
    })
  },

  editTemplate(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.managedTemplates.find((template) => String(template.id) === String(id))
    if (!item) {
      return
    }
    this.setData({
      templateForm: {
        id: item.id,
        name: item.name,
        category: item.category,
        fileType: item.fileType || String(item.type || '').toLowerCase(),
        size: item.size || '',
        url: item.url || '',
        description: item.description || ''
      }
    })
  },

  submitTemplate() {
    const form = this.data.templateForm
    if (!form.name || !form.category || !form.fileType || !form.url) {
      wx.showToast({ title: '请填写模板名称、分类、类型和链接', icon: 'none' })
      return
    }
    knowledgeService
      .saveTemplate({
        id: form.id || undefined,
        name: form.name,
        category: form.category,
        fileType: form.fileType,
        size: form.size,
        url: form.url,
        description: form.description,
        owner: this.data.dashboard.user.name
      })
      .then(() => {
        wx.showToast({ title: '模板已保存', icon: 'success' })
        this.setData({
          templateForm: { ...emptyTemplateForm }
        })
        this.refreshManagedTemplates()
      })
  },

  archiveTemplate(event) {
    const id = event.currentTarget.dataset.id
    knowledgeService.archiveTemplate(id).then(() => {
      wx.showToast({ title: '模板已归档', icon: 'success' })
      this.refreshManagedTemplates()
    })
  },

  refreshManagedAnnouncements() {
    if (!this.data.dashboard.canManage) {
      return
    }
    announcementService.fetchManagedAnnouncements({ status: '全部' }).then((items) => {
      this.setData({
        managedAnnouncements: items.map((item) => ({
          ...item,
          tagsText: (item.tags || []).join('、'),
          targetsText: (item.targets || []).map((target) => `${target.type}:${target.value}`).join('、'),
          statusText:
            item.status === 'published'
              ? '已发布'
              : item.status === 'withdrawn'
                ? '已撤回'
                : item.status === 'archived'
                  ? '已归档'
                  : '草稿',
          statusClass: item.status === 'published' ? 'success' : item.status === 'withdrawn' ? 'warn' : 'neutral',
          canPublish: item.status !== 'published',
          canWithdraw: item.status === 'published'
        }))
      })
    })
  },

  editAnnouncement(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.managedAnnouncements.find((announcement) => String(announcement.id) === String(id))
    if (!item) {
      return
    }
    this.setData({
      announcementForm: {
        id: item.id,
        title: item.title,
        summary: item.summary || '',
        content: item.content || '',
        sourceName: item.sourceName || '',
        sourceUrl: item.sourceUrl || '',
        priority: item.priority || 'normal',
        tagsText: (item.tags || []).join('，'),
        targetsText: (item.targets || []).map((target) => `${target.type}:${target.value}`).join('，') || 'all:全部',
        publishAt: item.publishAt || '',
        expireAt: item.expireAt || ''
      }
    })
  },

  submitAnnouncement() {
    const form = this.data.announcementForm
    if (!form.title || !form.content) {
      wx.showToast({ title: '请填写标题和正文', icon: 'none' })
      return
    }
    announcementService
      .saveAnnouncement({
        id: form.id || undefined,
        title: form.title,
        summary: form.summary,
        content: form.content,
        sourceName: form.sourceName,
        sourceUrl: form.sourceUrl,
        priority: form.priority || 'normal',
        status: 'draft',
        tags: form.tagsText
          .split(/[,，、]/)
          .map((item) => item.trim())
          .filter(Boolean),
        targets: this.parseTargets(form.targetsText),
        publishAt: form.publishAt,
        expireAt: form.expireAt
      })
      .then(() => {
        wx.showToast({ title: '通知已保存', icon: 'success' })
        this.setData({
          announcementForm: { ...emptyAnnouncementForm }
        })
        this.refreshManagedAnnouncements()
      })
  },

  publishAnnouncement(event) {
    const id = event.currentTarget.dataset.id
    announcementService.publishAnnouncement(id).then((result) => {
      wx.showToast({ title: result.delivered ? `已发布${result.delivered}人` : '已发布', icon: 'success' })
      this.refreshManagedAnnouncements()
    })
  },

  withdrawAnnouncement(event) {
    const id = event.currentTarget.dataset.id
    announcementService.withdrawAnnouncement(id).then(() => {
      wx.showToast({ title: '已撤回', icon: 'success' })
      this.refreshManagedAnnouncements()
    })
  },

  parseTargets(text) {
    const items = String(text || 'all:全部')
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean)
    return items.map((item) => {
      const parts = item.split(':')
      return {
        type: parts[0] || 'all',
        value: parts.slice(1).join(':') || '全部'
      }
    })
  },

  refreshManagedApprovals() {
    const user = this.data.dashboard.user || {}
    if (!this.hasDashboardPermission(user, 'approve_requests')) {
      return
    }
    approvalService
      .fetchManagedRequests({
        keyword: this.data.approvalKeyword,
        status: '全部'
      })
      .then((items) => {
        this.setData({
          managedApprovals: items.map((item) => ({
            ...item,
            statusClass: item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'warn' : 'neutral'
          }))
        })
      })
  },

  approveRequest(event) {
    const id = event.currentTarget.dataset.id
    approvalService.approveRequest(id, this.data.approvalComment).then(() => {
      wx.showToast({ title: '已通过', icon: 'success' })
      this.setData({ approvalComment: '' })
      this.refreshManagedApprovals()
    })
  },

  rejectRequest(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '驳回申请',
      editable: true,
      placeholderText: '请填写驳回原因',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        const reason = res.content || this.data.approvalComment || '材料需修改后重新提交'
        approvalService.rejectRequest(id, reason).then(() => {
          wx.showToast({ title: '已驳回', icon: 'success' })
          this.refreshManagedApprovals()
        })
      }
    })
  },

  switchManageProcessType(event) {
    const type = event.currentTarget.dataset.type
    this.setData({
      activeManageProcessType: type,
      stageForm: {
        ...this.data.stageForm,
        processType: type
      },
      progressForm: {
        ...this.data.progressForm,
        processType: type
      }
    })
    this.refreshManagedStages()
    this.refreshManagedProgress()
  },

  editStage(event) {
    const code = event.currentTarget.dataset.code
    const stage = this.data.managedStages.find((item) => item.stageCode === code)
    if (!stage) {
      return
    }
    this.setData({
      stageForm: {
        processType: stage.processType,
        stageCode: stage.stageCode,
        name: stage.name,
        shortName: stage.shortName || '',
        description: stage.description || '',
        actionsText: (stage.actions || []).join('，'),
        reminderDays: stage.reminderDays || '',
        sortOrder: stage.sortOrder || ''
      }
    })
  },

  submitStage() {
    const form = this.data.stageForm
    if (!form.stageCode || !form.name) {
      wx.showToast({ title: '请填写节点编码和名称', icon: 'none' })
      return
    }
    processService
      .saveProcessStage({
        processType: form.processType,
        stageCode: form.stageCode,
        name: form.name,
        shortName: form.shortName,
        description: form.description,
        actions: form.actionsText
          .split(/[,，、]/)
          .map((item) => item.trim())
          .filter(Boolean),
        reminderDays: Number(form.reminderDays) || 0,
        sortOrder: Number(form.sortOrder) || 0
      })
      .then(() => {
        wx.showToast({ title: '流程节点已保存', icon: 'success' })
        this.setData({
          stageForm: {
            ...emptyStageForm,
            processType: this.data.activeManageProcessType
          }
        })
        this.refreshManagedStages()
      })
  },

  refreshManagedStages() {
    if (!this.data.canManageProcess) {
      return
    }
    processService.fetchManagedStages(this.data.activeManageProcessType).then((items) => {
      this.setData({
        managedStages: items
      })
    })
  },

  refreshManagedProgress() {
    if (!this.data.canManageProcess) {
      return
    }
    processService
      .fetchManagedProgress({
        keyword: this.data.progressKeyword,
        processType: this.data.activeManageProcessType
      })
      .then((items) => {
        this.setData({
          managedProgress: items.map((item) => ({
            ...item,
            completedActionsText: (item.completedActions || []).join('、')
          }))
        })
      })
  },

  editProgress(event) {
    const studentNo = event.currentTarget.dataset.studentNo
    const item = this.data.managedProgress.find((progress) => progress.studentNo === studentNo)
    if (!item) {
      return
    }
    this.setData({
      progressForm: {
        studentNo: item.studentNo,
        processType: item.processType || this.data.activeManageProcessType,
        currentStageCode: item.currentStageCode || '',
        startedAt: item.startedAt || '',
        nextDeadline: item.nextDeadline || '',
        advisor: item.advisor || '',
        completedActionsText: (item.completedActions || []).join('，')
      }
    })
  },

  submitProgress() {
    const form = this.data.progressForm
    if (!form.studentNo || !form.currentStageCode) {
      wx.showToast({ title: '请填写学号和当前节点', icon: 'none' })
      return
    }
    processService
      .saveStudentProgress({
        studentNo: form.studentNo,
        processType: form.processType,
        currentStageCode: form.currentStageCode,
        startedAt: form.startedAt,
        nextDeadline: form.nextDeadline,
        advisor: form.advisor,
        completedActions: form.completedActionsText
          .split(/[,，、]/)
          .map((item) => item.trim())
          .filter(Boolean)
      })
      .then(() => {
        wx.showToast({ title: '进度已保存', icon: 'success' })
        this.setData({
          progressForm: {
            ...emptyProgressForm,
            processType: this.data.activeManageProcessType
          }
        })
        this.refreshManagedProgress()
      })
  },

  refreshManagedStudents() {
    profileService
      .fetchManagedStudents({
        keyword: this.data.studentKeyword
      })
      .then((items) => {
        this.setData({
          managedStudents: items.map((item) => ({
            ...item,
            sensitiveTagText: item.sensitiveVisible ? '敏感可见' : '已脱敏',
            sensitiveTagClass: item.sensitiveVisible ? 'success' : 'neutral',
            alumniText: item.isAlumni ? '校友/离校' : '在校'
          }))
        })
      })
  }
})
