const roles = {
  STUDENT: 'student',
  CLASS_LEADER: 'class_leader',
  COUNSELOR: 'counselor',
  COLLEGE_LEADER: 'college_leader',
  SUPER_ADMIN: 'super_admin'
}

const currentUser = {
  id: 'u2024001',
  accountName: '2024001001',
  role: roles.SUPER_ADMIN,
  name: '李同学',
  studentNo: '2024001001',
  college: '信息学院',
  major: '计算机科学与技术',
  className: '计科 2401',
  grade: '2024级',
  politicalStatus: '共青团员',
  partyStage: 'activist',
  leagueStage: 'member',
  isAdminAccount: true
}

const rolePermissions = {
  student: ['read_public', 'read_own_progress', 'quiz'],
  class_leader: ['read_public', 'read_own_progress', 'quiz', 'manage_public_content', 'view_operation_records'],
  counselor: [
    'read_public',
    'read_own_progress',
    'quiz',
    'read_sensitive',
    'audit_content',
    'manage_public_content',
    'manage_process',
    'import_students',
    'import_quiz',
    'view_operation_records'
  ],
  college_leader: ['read_public', 'read_sensitive', 'view_statistics', 'view_operation_records'],
  super_admin: ['read_public', 'read_sensitive', 'manage_all', 'view_operation_records']
}

const knowledgeItems = [
  {
    id: 'k-scholarship-001',
    title: '奖学金评定常见问题',
    category: '奖助学金',
    tags: ['奖学金', '评奖评优', '成绩排名'],
    keywords: ['奖学金', '评奖', '评优', '综测', '综合测评', '成绩排名'],
    answer:
      '奖学金评定以学院当年发布的评奖评优通知为准，通常综合考虑课程成绩、综合测评、处分记录、材料提交时间等因素。请先查看通知附件中的申报条件和时间安排。',
    officialLink: 'https://example.edu.cn/scholarship',
    updatedAt: '2026-03-10',
    owner: '学院团委'
  },
  {
    id: 'k-leave-001',
    title: '休学、复学办理说明',
    category: '学籍事务',
    tags: ['休学', '复学', '学籍'],
    keywords: ['休学', '复学', '保留学籍', '学籍异动'],
    answer:
      '休学、复学属于学籍异动事项，应按学校教务部门流程提交申请。小程序仅提供政策指引，具体审批以学校正式系统和学院通知为准。',
    officialLink: 'https://example.edu.cn/student-status',
    updatedAt: '2026-02-18',
    owner: '本科教务办公室',
    sensitiveHint: '涉及个人健康、家庭情况等敏感原因时，请直接联系辅导员，不在公开问答中填写细节。'
  },
  {
    id: 'k-archive-001',
    title: '查档调档与证明材料',
    category: '证明材料',
    tags: ['查档', '调档', '证明'],
    keywords: ['查档', '调档', '证明', '政审', '档案'],
    answer:
      '查档、调档和政审材料通常需要提前准备身份证明、单位函件或学院盖章申请。请在模板区下载对应材料清单，并按通知要求提交。',
    officialLink: 'https://example.edu.cn/archive',
    updatedAt: '2026-01-09',
    owner: '学生工作办公室'
  },
  {
    id: 'k-dorm-001',
    title: '宿舍调整申请说明',
    category: '校园生活',
    tags: ['宿舍', '后勤'],
    keywords: ['宿舍', '调宿', '住宿', '后勤'],
    answer:
      '宿舍调整需符合学校后勤部门的开放时间和申请条件。学院可协助核验学生身份，但最终安排以学校后勤平台结果为准。',
    officialLink: 'https://example.edu.cn/dormitory',
    updatedAt: '2026-04-01',
    owner: '后勤部门'
  },
  {
    id: 'k-party-001',
    title: '入党申请书提交后多久进入下一阶段',
    category: '党团事务',
    tags: ['入党', '积极分子', '提醒'],
    keywords: ['入党', '申请书', '积极分子', '思想汇报', '发展对象'],
    answer:
      '提交入党申请书后，党支部会结合谈话、培养考察和支部安排确定后续节点。积极分子、发展对象等阶段均需满足培养考察和材料要求。',
    officialLink: 'https://example.edu.cn/party-process',
    updatedAt: '2026-03-22',
    owner: '学院党委'
  }
]

const templates = [
  {
    id: 'tpl-proof-001',
    name: '在读证明申请模板',
    type: 'Word',
    category: '证明材料',
    size: '38KB',
    updatedAt: '2026-03-01',
    url: 'https://example.edu.cn/templates/student-proof.docx',
    description: '适用于普通在读证明、学籍证明等材料申请。'
  },
  {
    id: 'tpl-leave-001',
    name: '学院活动请假条模板',
    type: 'Word',
    category: '日常事务',
    size: '24KB',
    updatedAt: '2026-02-11',
    url: 'https://example.edu.cn/templates/leave-note.docx',
    description: '供学院活动、会议等场景使用，正式请假仍以学校系统为准。'
  },
  {
    id: 'tpl-budget-001',
    name: '学生活动预算表',
    type: 'Excel',
    category: '学生组织',
    size: '42KB',
    updatedAt: '2026-01-19',
    url: 'https://example.edu.cn/templates/activity-budget.xlsx',
    description: '用于党团学活动经费预算、报销前置材料整理。'
  },
  {
    id: 'tpl-briefing-001',
    name: '活动简报模板',
    type: 'Word',
    category: '学生组织',
    size: '61KB',
    updatedAt: '2026-04-06',
    url: 'https://example.edu.cn/templates/news-brief.docx',
    description: '用于团日活动、志愿服务、专题学习等记录归档。'
  }
]

const partyStages = [
  {
    id: 'applicant',
    name: '入党申请人',
    shortName: '申请人',
    description: '提交入党申请书，接受党组织谈话和基础培养。',
    actions: ['提交入党申请书', '完成组织谈话', '参加基础理论学习'],
    reminderDays: 30
  },
  {
    id: 'activist',
    name: '入党积极分子',
    shortName: '积极分子',
    description: '完成培养联系人对接，按要求提交思想汇报和学习记录。',
    actions: ['确定培养联系人', '每季度提交思想汇报', '参加集中培训'],
    reminderDays: 90
  },
  {
    id: 'development',
    name: '发展对象',
    shortName: '发展对象',
    description: '接受政治审查、集中培训、公示等发展对象阶段工作。',
    actions: ['完成政治审查', '参加发展对象培训', '完成支部公示'],
    reminderDays: 60
  },
  {
    id: 'probationary',
    name: '预备党员',
    shortName: '预备',
    description: '进入预备期，按期参加组织生活并提交转正申请。',
    actions: ['参加组织生活', '提交季度思想汇报', '预备期满提交转正申请'],
    reminderDays: 365
  },
  {
    id: 'full',
    name: '正式党员',
    shortName: '正式',
    description: '完成转正流程，持续参加组织生活和党员教育。',
    actions: ['参加组织生活', '完成党员教育学习', '参与支部服务'],
    reminderDays: 180
  }
]

const leagueStages = [
  {
    id: 'applicant',
    name: '入团申请人',
    shortName: '申请',
    description: '提交入团申请书，接受团支部教育培养。',
    actions: ['提交入团申请书', '参加团课学习'],
    reminderDays: 30
  },
  {
    id: 'candidate',
    name: '团员发展对象',
    shortName: '发展',
    description: '完成团课、支部评议和材料审核。',
    actions: ['完成团课', '参加支部评议', '提交发展材料'],
    reminderDays: 60
  },
  {
    id: 'member',
    name: '共青团员',
    shortName: '团员',
    description: '完成入团流程，参与团组织生活和年度教育评议。',
    actions: ['参加团日活动', '完成智慧团建信息维护', '参与年度教育评议'],
    reminderDays: 180
  }
]

const progressRecords = {
  u2024001: {
    party: {
      currentStageId: 'activist',
      startedAt: '2026-02-20',
      completedActionIds: ['提交入党申请书', '完成组织谈话', '确定培养联系人'],
      nextDeadline: '2026-05-20',
      advisor: '王老师'
    },
    league: {
      currentStageId: 'member',
      startedAt: '2024-09-15',
      completedActionIds: ['参加团日活动', '完成智慧团建信息维护'],
      nextDeadline: '2026-06-30',
      advisor: '计科 2401 团支书'
    }
  }
}

const quizQuestions = [
  {
    id: 'q1',
    stem: '入党积极分子通常需要按要求提交哪类培养记录材料？',
    options: ['思想汇报', '课程退选表', '宿舍维修单', '校园卡挂失单'],
    answerIndex: 0,
    explanation: '思想汇报是培养考察中的常见材料之一，具体频次以党支部要求为准。'
  },
  {
    id: 'q2',
    stem: '党团流程中的关键节点提醒主要用于什么目的？',
    options: ['替代老师审批', '提醒学生按时完成材料和学习要求', '自动生成成绩单', '开放所有敏感信息'],
    answerIndex: 1,
    explanation: '提醒功能用于降低遗漏材料和错过节点的风险，不替代正式审批。'
  },
  {
    id: 'q3',
    stem: '涉及个人身份证号、手机号、生源地等敏感信息时，平台应如何处理？',
    options: ['公开展示给所有学生', '仅按权限查看并避免在公开问答中展示', '放在通知标题里', '无需记录访问日志'],
    answerIndex: 1,
    explanation: '敏感信息需要按权限控制，管理员操作也应留痕。'
  },
  {
    id: 'q4',
    stem: '入团或入党流程发生细微调整时，系统更适合如何维护？',
    options: ['删除所有历史记录', '通过流程配置更新节点说明和提醒时间', '让学生自行猜测', '停用问答模块'],
    answerIndex: 1,
    explanation: '流程配置化能支持后续微调，同时保留历史记录。'
  }
]

const adminLogs = [
  {
    id: 'log-001',
    operator: '李同学',
    role: '班团骨干',
    action: '更新知识库条目',
    target: '奖学金评定常见问题',
    createdAt: '2026-04-09 14:22'
  },
  {
    id: 'log-002',
    operator: '王老师',
    role: '辅导员',
    action: '导入模板',
    target: '活动简报模板',
    createdAt: '2026-04-06 09:35'
  },
  {
    id: 'log-003',
    operator: '系统管理员',
    role: '超级管理员',
    action: '调整流程提醒',
    target: '入党积极分子 90 天提醒',
    createdAt: '2026-03-28 16:10'
  }
]

const futureModules = [
  {
    id: 'news',
    name: '信息集成与精准推送',
    status: 'reserved',
    api: 'services/futureService.getNewsFeeds',
    description: '预留官方通知聚合、标签化分发、小程序消息和邮件推送接口。'
  },
  {
    id: 'approval',
    name: '电子证明与审批',
    status: 'reserved',
    api: 'services/futureService.getApprovalRequests',
    description: '预留证明生成、盖章申请、附件查看、分级审批和审批留痕接口。'
  },
  {
    id: 'academic',
    name: '学业分析与预警',
    status: 'reserved',
    api: 'services/futureService.getAcademicWarnings',
    description: '预留培养方案、成绩单解析、学分缺口分析接口；当前不进入主流程。'
  }
]

module.exports = {
  roles,
  currentUser,
  rolePermissions,
  knowledgeItems,
  templates,
  partyStages,
  leagueStages,
  progressRecords,
  quizQuestions,
  adminLogs,
  futureModules
}
