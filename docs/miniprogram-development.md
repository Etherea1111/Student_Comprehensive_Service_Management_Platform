# 学院学生综合服务微信小程序开发说明

## 当前范围

本阶段已实现 README 中优先级最高的四个业务模块，并补充后端落地骨架：

1. 智能问答与政策知识库
   - 关键词检索标准答复。
   - 按分类查看政策条目。
   - 展示来源单位、更新时间、官方链接和敏感信息提示。
   - 常用 Word/Excel 模板列表，支持下载/打开；示例链接不可访问时自动复制链接。
   - 管理员侧提供知识库草稿录入和文件选择演示，文件策略为 30MB 上限。

2. 党团事务流程管理
   - 入党、入团流程线性展示。
   - 学生当前阶段、已完成动作、下一节点和负责人展示。
   - 关键节点提醒。
   - 党建与流程基础理论自测。

3. 信息集成与精准推送
   - 学生端通知中心，支持关键词、标签和未读筛选。
   - 管理员端通知录入、目标人群、发布和撤回。
   - 后端发布时写入小程序站内投递和已读记录。

4. 电子证明生成与审批流程
   - 学生端证明/盖章申请、附件选择、涉密说明、草稿和提交。
   - 管理员端待审批列表、通过、驳回。
   - 后端保存申请、附件、审批记录，驳回后支持原申请修改再提交。

学业情况分析与预警仍为预留模块，不进入当前主流程。

## 运行方式

1. 安装微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择仓库根目录：`Student_Comprehensive_Service_Management_Platform`。
4. AppID 可继续使用测试号或替换为真实小程序 AppID。
5. 编译运行即可。

工程配置在仓库根目录的 `project.config.json`，小程序源码根目录是 `miniprogram/`。

## 目录结构

```text
miniprogram/
  app.js
  app.json
  app.wxss
  data/
    mockData.js
  pages/
    home/       首页、核心模块入口
    announcements/ 模块三：通知中心、标签筛选、已读
    approvals/  模块四：证明和盖章申请
    qa/         模块一：智能问答、知识库、模板
    process/    模块二：党团流程、进度、提醒
    quiz/       理论自测
    mine/       我的、角色权限、隐私说明
    admin/      管理员维护、公告发布、审批、草稿录入、日志
  services/
    announcementService.js
    approvalService.js
    knowledgeService.js
    processService.js
    quizService.js
    profileService.js
    adminService.js
    futureService.js
  utils/
    format.js
```

## 角色和权限

当前 `data/mockData.js` 中内置了演示用户，角色为“班团骨干”，具备公开内容维护和操作日志查看权限。配置后端后，登录页支持账号注册、密码登录、首次学生信息绑定和修改密码；暂不提供找回密码功能，角色和权限由服务端返回。

已预留角色：

- 普通学生
- 班团骨干
- 班主任/辅导员
- 学院领导
- 超级管理员

初始化数据内置独立超级管理员账号 `2024000001`，密码 `123456`。该账号不绑定学生信息，拥有 `super_admin` 的全部权限，且不支持在小程序内修改密码。

## 后端接口

当前页面只调用 `services/` 层。现在已提供 `miniprogram/config/env.js` 和 `services/request.js`，配置后端 HTTPS 地址后，小程序会优先调用真实 API；未配置时继续使用本地数据兜底。

主要接口：

```text
GET  /api/profile/me
GET  /api/knowledge?keyword=&category=
POST /api/knowledge/drafts
GET  /api/templates?category=
GET  /api/processes/party/me
GET  /api/processes/league/me
GET  /api/quiz/questions
POST /api/quiz/records
GET  /api/announcements
POST /api/announcements/:id/read
POST /api/announcements/manage
POST /api/announcements/:id/publish
GET  /api/approvals/mine
POST /api/approvals
POST /api/approvals/:id/attachments
GET  /api/approvals/manage
POST /api/approvals/:id/approve
POST /api/approvals/:id/reject
GET  /api/admin/logs
```

仍预留的后续模块：

- `futureService.getAcademicWarnings()`：学业情况分析与预警。

## 数据接入建议

真实后端建议分层：

- 小程序端：只负责展示、表单、文件选择、调用 API。
- 后端服务：负责账号注册登录、学生信息绑定、权限校验、文件上传、知识库维护、流程配置、日志记录。
- 数据库：按需求使用 Kingbase，敏感字段加密存储。
- 文件服务：保存 Word/Excel/PDF 原文件，数据库只保存文件元数据和访问权限。

敏感信息如身份证号、手机号、生源地、户籍、休学/延毕状态等不应进入公开知识库内容。

## 当前状态与限制

- 当前已具备小程序前端和后端 API 骨架，数据可来自真实后端，也可在未配置后端时来自 `mockData.js` 和本机缓存。
- 模板下载当前已调用 `wx.downloadFile` 和 `wx.openDocument`，示例链接不可访问时会降级为复制链接；真实环境需替换为可访问的后端签名下载链接。
- 管理员草稿提交在配置后端后会提交到 `/api/knowledge/drafts`；未配置后端时写入本机缓存。
- 公告与审批在未配置后端时使用本机缓存演示；生产环境需配置 HTTPS 后端和真实数据库。
- 理论自测题库可通过后端导入接口维护，当前种子数据仍为示例题。
