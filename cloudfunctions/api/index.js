const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const demoUser = {
  id: '2',
  accountName: '2024000001',
  role: 'super_admin',
  mustChangePassword: false,
  passwordChangeDisabled: true,
  extraPermissions: [],
  permissions: [
    'manage_all',
    'read_public',
    'read_own_progress',
    'manage_public_content',
    'audit_content',
    'manage_process',
    'approve_requests',
    'read_sensitive',
    'view_operation_records',
    'manage_accounts',
    'import_students',
    'import_quiz'
  ],
  studentNo: '2024000001',
  name: '云开发演示管理员',
  college: '信息工程学院',
  major: '软件工程',
  className: '软工2401',
  grade: '2024',
  politicalStatus: '共青团员',
  partyStage: '入党积极分子',
  leagueStage: '智慧团建已同步',
  canChangePassword: false,
  isAdminAccount: true
}

const demoToken = 'cloud-demo-token'

const knowledgeItems = [
  {
    id: 'k1',
    title: '奖助学金申请材料',
    category: '学生资助',
    answer: '准备申请表、成绩单、困难认定材料，并在学院通知期限内提交。',
    tags: ['奖学金', '资助'],
    keywords: ['奖助学金', '困难认定'],
    updatedAt: '2026-05-28 09:00'
  },
  {
    id: 'k2',
    title: '入党积极分子培养流程',
    category: '党团建设',
    answer: '完成申请、推优、培养考察、培训结业等节点后进入后续发展流程。',
    tags: ['入党', '流程'],
    keywords: ['积极分子', '培养考察'],
    updatedAt: '2026-05-28 09:30'
  },
  {
    id: 'k3',
    title: '在读证明办理',
    category: '证明服务',
    answer: '在电子证明模块填写用途并提交，辅导员审核通过后可下载证明文件。',
    tags: ['证明', '审核'],
    keywords: ['在读证明', '盖章'],
    updatedAt: '2026-05-28 10:00'
  }
]

const templates = [
  {
    id: 'tpl1',
    name: '在读证明申请模板',
    category: '证明服务',
    type: 'DOCX',
    fileType: 'docx',
    size: '36KB',
    url: '',
    description: '用于课程答辩演示的证明申请模板。',
    owner: '学院学生工作办公室',
    status: 'published',
    statusText: '已发布'
  },
  {
    id: 'tpl2',
    name: '奖助学金材料清单',
    category: '学生资助',
    type: 'PDF',
    fileType: 'pdf',
    size: '128KB',
    url: '',
    description: '汇总奖助学金申请所需附件。',
    owner: '学院学生工作办公室',
    status: 'published',
    statusText: '已发布'
  }
]

const partyStages = [
  {
    id: 'apply',
    name: '提交入党申请书',
    shortName: '申请',
    description: '提交入党申请并完成谈话记录。',
    actions: ['提交申请书', '完成谈话'],
    reminderDays: 7
  },
  {
    id: 'activist',
    name: '入党积极分子培养',
    shortName: '积极分子',
    description: '完成推优、培训和培养考察。',
    actions: ['团支部推优', '党课培训', '季度考察'],
    reminderDays: 14
  },
  {
    id: 'development',
    name: '发展对象考察',
    shortName: '发展对象',
    description: '进入发展对象材料审核与政治审查。',
    actions: ['材料审核', '政治审查'],
    reminderDays: 14
  }
]

const leagueStages = [
  {
    id: 'member',
    name: '团员信息维护',
    shortName: '团员',
    description: '核对智慧团建与个人基础信息。',
    actions: ['核对团籍', '完善资料'],
    reminderDays: 7
  },
  {
    id: 'excellent',
    name: '优秀团员评议',
    shortName: '评议',
    description: '完成年度评议与材料归档。',
    actions: ['民主评议', '材料归档'],
    reminderDays: 10
  }
]

const processProgress = {
  party: {
    currentStageId: 'activist',
    startedAt: '2026-03-01',
    nextDeadline: '2026-06-15',
    advisor: '王老师',
    completedActionIds: ['提交申请书', '团支部推优']
  },
  league: {
    currentStageId: 'member',
    startedAt: '2026-02-20',
    nextDeadline: '2026-06-05',
    advisor: '李老师',
    completedActionIds: ['核对团籍']
  }
}

const announcements = [
  {
    id: 'ann1',
    title: '关于开展期末诚信考试教育的通知',
    summary: '请各班完成诚信考试主题班会并提交记录。',
    content: '请各班在本周内完成诚信考试主题班会，辅导员将抽查会议记录。',
    sourceName: '学院学生工作办公室',
    priority: 'normal',
    tags: ['教学通知', '班级事务'],
    targets: [{ type: 'all', value: '全部' }],
    status: 'published',
    publishAt: '2026-05-28 08:30',
    updatedAt: '2026-05-28 08:30',
    isRead: false
  },
  {
    id: 'ann2',
    title: '奖助学金材料预审提醒',
    summary: '请申请同学提前核对附件完整性。',
    content: '材料预审截止前，请确认申请表、证明材料和成绩单均已上传。',
    sourceName: '资助工作组',
    priority: 'high',
    tags: ['学生资助'],
    targets: [{ type: 'grade', value: '2024' }],
    status: 'published',
    publishAt: '2026-05-27 18:00',
    updatedAt: '2026-05-27 18:00',
    isRead: false
  }
]

const approvals = [
  {
    id: 'apr1',
    requestNo: 'PROOF-20260528001',
    requestType: 'proof',
    requestTypeText: '证明开具',
    title: '在读证明申请',
    purpose: '课程答辩演示',
    description: '用于演示电子证明申请流程。',
    status: 'pending',
    statusText: '待审批',
    currentStepText: '辅导员审批',
    studentNo: demoUser.studentNo,
    studentName: demoUser.name,
    className: demoUser.className,
    major: demoUser.major,
    updatedAt: '2026-05-28 10:20',
    submittedAt: '2026-05-28 10:20',
    previewContent: '兹证明该同学为我院在读学生。'
  }
]

const adminLogs = [
  { id: 'log1', action: '云开发演示登录', operator: demoUser.name, createdAt: '2026-05-28 10:00' },
  { id: 'log2', action: '读取演示数据', operator: demoUser.name, createdAt: '2026-05-28 10:05' }
]

function ok(data) {
  return { data }
}

function fail(message, statusCode = 400) {
  return { error: { message, statusCode } }
}

function getPath(url) {
  return String(url || '').split('?')[0].replace(/^\/api/, '') || '/'
}

function searchItems(items, keyword, fields) {
  const value = String(keyword || '').trim()
  if (!value) {
    return items
  }
  return items.filter((item) => fields.map((field) => item[field]).join(' ').indexOf(value) >= 0)
}

function getCategories(items, field) {
  return ['全部'].concat(Array.from(new Set(items.map((item) => item[field]).filter(Boolean))))
}

function getProcessOverview(type) {
  const stages = type === 'league' ? leagueStages : partyStages
  const progress = processProgress[type] || null
  const currentIndex = progress ? stages.findIndex((stage) => stage.id === progress.currentStageId) : -1
  return {
    type,
    stages,
    progress,
    currentIndex,
    currentStage: currentIndex >= 0 ? stages[currentIndex] : null
  }
}

function buildManagedProgress(type) {
  const overview = getProcessOverview(type || 'party')
  if (!overview.progress || !overview.currentStage) {
    return []
  }
  return [
    {
      studentNo: demoUser.studentNo,
      name: demoUser.name,
      className: demoUser.className,
      grade: demoUser.grade,
      major: demoUser.major,
      processType: overview.type,
      currentStageCode: overview.progress.currentStageId,
      currentStageName: overview.currentStage.name,
      startedAt: overview.progress.startedAt,
      completedActions: overview.progress.completedActionIds,
      nextDeadline: overview.progress.nextDeadline,
      advisor: overview.progress.advisor
    }
  ]
}

function handleLogin(data) {
  const accountName = data.accountName || '2024000001'
  if (data.password !== undefined && !data.password) {
    return fail('请输入密码')
  }
  return ok({
    token: demoToken,
    user: {
      ...demoUser,
      accountName
    },
    mustChangePassword: false,
    bindingRequired: false
  })
}

function route(event) {
  const method = String(event.method || 'GET').toUpperCase()
  const path = getPath(event.url)
  const data = event.data || {}

  if (method === 'UPLOAD') {
    return ok({
      id: `cloud-file-${Date.now()}`,
      originalName: '云开发演示文件',
      fileType: 'file',
      size: '0KB',
      url: '',
      downloadPath: ''
    })
  }

  if (path === '/auth/password-login' && method === 'POST') return handleLogin(data)
  if (path === '/auth/wechat-login' && method === 'POST') return handleLogin(data)
  if (path === '/auth/register' && method === 'POST') return handleLogin(data)
  if (path === '/auth/bind-student' && method === 'POST') return ok({ token: demoToken, user: demoUser })
  if (path === '/auth/change-password' && method === 'POST') return ok({ changed: true })

  if (path === '/profile/me') return ok(demoUser)
  if (path === '/profile/students') {
    return ok({
      items: [
        {
          ...demoUser,
          ethnicity: '汉族',
          advisor: '王老师',
          studentStatus: '在读',
          isAlumni: false,
          awards: '优秀学生干部',
          remark: '云开发演示数据',
          phone: '13800000000',
          idCard: '110101200001010011',
          birthplace: '北京市',
          householdRegister: '北京市海淀区',
          sensitiveVisible: true,
          updatedAt: '2026-05-28 10:00'
        }
      ]
    })
  }

  if (path === '/knowledge') {
    const items = searchItems(knowledgeItems, data.keyword, ['title', 'category', 'answer']).filter(
      (item) => !data.category || data.category === '全部' || item.category === data.category
    )
    return ok({ items })
  }
  if (path === '/knowledge/categories') return ok({ categories: getCategories(knowledgeItems, 'category') })
  if (path === '/knowledge/manage') return ok({ items: knowledgeItems.map((item) => ({ ...item, status: 'published', statusText: '已发布' })) })
  if (path === '/knowledge/drafts' && method === 'POST') return ok({ id: `draft-${Date.now()}`, status: 'draft', statusText: '待复核', ...data })
  if (/^\/knowledge\/drafts\/[^/]+\/(publish|reject)$/.test(path) && method === 'POST') return ok({ id: path.split('/')[3], status: path.endsWith('/publish') ? 'published' : 'rejected' })
  if (/^\/knowledge\/[^/]+\/archive$/.test(path) && method === 'POST') return ok({ id: path.split('/')[2], status: 'archived' })
  if (path === '/knowledge/feedback' && method === 'POST') return ok({ id: `feedback-${Date.now()}`, status: 'open', ...data })
  if (path === '/knowledge/feedback/manage') return ok({ items: [] })
  if (/^\/knowledge\/feedback\/[^/]+\/handle$/.test(path) && method === 'POST') return ok({ id: path.split('/')[3], status: 'handled' })
  if (/^\/knowledge\/[^/]+\/versions$/.test(path)) return ok({ items: [] })

  if (path === '/templates') {
    if (method === 'PUT') return ok({ id: data.id || `tpl-${Date.now()}`, status: 'published', statusText: '已发布', ...data })
    const items = templates.filter((item) => !data.category || data.category === '全部' || item.category === data.category)
    return ok({ items })
  }
  if (path === '/templates/manage') return ok({ items: templates })
  if (path === '/templates/categories') return ok({ categories: getCategories(templates, 'category') })
  if (/^\/templates\/[^/]+\/archive$/.test(path) && method === 'POST') return ok({ id: path.split('/')[2], status: 'archived' })

  if (/^\/processes\/(party|league)\/me$/.test(path)) return ok(getProcessOverview(path.split('/')[2]))
  if (path === '/processes/stages/manage') {
    const type = data.type || 'party'
    return ok({
      items: (type === 'league' ? leagueStages : partyStages).map((stage, index) => ({
        ...stage,
        processType: type,
        stageCode: stage.id,
        sortOrder: index + 1,
        enabled: true
      }))
    })
  }
  if (path === '/processes/stages' && method === 'PUT') return ok({ id: `${data.processType}-${data.stageCode}`, enabled: true, ...data })
  if (path === '/processes/progress/manage') return ok({ items: buildManagedProgress(data.processType || 'party') })
  if (path === '/processes/progress' && method === 'PUT') return ok({ ...data, saved: true })
  if (path === '/processes/reminders/due') {
    return ok({
      items: buildManagedProgress(data.processType || 'party').map((item) => ({
        ...item,
        daysLeft: 7,
        status: 'upcoming'
      }))
    })
  }

  if (path === '/announcements') {
    return ok({
      items: announcements.filter((item) => !data.tag || data.tag === '全部' || item.tags.indexOf(data.tag) >= 0)
    })
  }
  if (path === '/announcements/tags') return ok({ tags: getCategories(announcements.flatMap((item) => item.tags.map((tag) => ({ tag }))), 'tag').map((name, index) => ({ id: index, name })) })
  if (path === '/announcements/manage') {
    if (method === 'POST') return ok({ id: data.id || `ann-${Date.now()}`, status: data.status || 'draft', ...data })
    return ok({ items: announcements })
  }
  if (/^\/announcements\/[^/]+\/(read|publish|withdraw|dispatch)$/.test(path) && method === 'POST') {
    const action = path.split('/')[3]
    return ok({ id: path.split('/')[2], status: action === 'withdraw' ? 'withdrawn' : 'published', delivered: 1, queued: 1, readAt: new Date().toISOString() })
  }
  if (/^\/announcements\/[^/]+\/deliveries$/.test(path)) return ok({ items: [] })
  if (path === '/announcements/manage/sources') {
    if (method === 'POST') return ok({ id: data.id || `source-${Date.now()}`, ...data })
    return ok({ items: [] })
  }
  if (/^\/announcements\/manage\/sources\/[^/]+\/import$/.test(path) && method === 'POST') return ok({ id: `ann-${Date.now()}`, status: 'draft' })

  if (path === '/approvals/mine') return ok({ items: approvals })
  if (path === '/approvals/manage') return ok({ items: approvals })
  if (path === '/approvals' && method === 'POST') return ok({ id: data.id || `apr-${Date.now()}`, status: data.submit ? 'pending' : 'draft', ...data })
  if (/^\/approvals\/[^/]+$/.test(path)) return ok(approvals.find((item) => item.id === path.split('/')[2]) || null)
  if (/^\/approvals\/[^/]+\/(submit|withdraw|approve|reject)$/.test(path) && method === 'POST') {
    const action = path.split('/')[3]
    const statusMap = { submit: 'pending', withdraw: 'withdrawn', approve: 'approved', reject: 'rejected' }
    return ok({ id: path.split('/')[2], status: statusMap[action] || 'pending' })
  }

  if (path === '/admin/dashboard') {
    return ok({
      user: demoUser,
      canManage: true,
      metrics: [
        { label: '知识库条目', value: knowledgeItems.length },
        { label: '模板文件', value: templates.length },
        { label: '流程配置', value: partyStages.length + leagueStages.length },
        { label: '待复核内容', value: 1 }
      ],
      logs: adminLogs
    })
  }
  if (path === '/admin/logs') return ok({ items: adminLogs })
  if (path === '/admin/upload-policy') return ok({ allowedTypes: ['doc', 'docx', 'xls', 'xlsx', 'csv', 'pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 30, auditRequired: true, ownerRule: '演示环境仅保留元数据，不上传真实附件。' })
  if (path === '/admin/accounts') {
    if (method === 'PUT') return ok({ id: data.id || `account-${Date.now()}`, ...data })
    return ok({ items: [demoUser] })
  }
  if (/^\/admin\/accounts\/[^/]+\/disable$/.test(path) && method === 'POST') return ok({ id: path.split('/')[3], disabled: true })

  if (path === '/quiz/questions') return ok({ items: [] })
  if (path === '/quiz/records' && method === 'POST') return ok({ score: 0, total: 0, details: [] })

  if (path === '/work-records') {
    if (method === 'PUT') return ok({ id: data.id || `work-${Date.now()}`, status: data.status || 'published', ...data })
    return ok({ items: [] })
  }
  if (/^\/work-records\/[^/]+\/archive$/.test(path) && method === 'POST') return ok({ id: path.split('/')[2], status: 'archived' })

  return fail(`云开发演示接口暂未覆盖：${method} ${path}`, 404)
}

exports.main = async (event) => {
  try {
    return route(event || {})
  } catch (error) {
    return fail(error.message || 'Cloud function error', 500)
  }
}
