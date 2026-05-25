# 后端部署与接口说明

## 1. 后端能力范围

当前仓库已包含可继续落地部署的 Node.js 后端骨架，覆盖以下能力：

- 账号注册、密码登录与学生实名绑定接口。
- 修改密码接口。
- JWT 登录态。
- 角色权限校验。
- 学生信息 Excel 导入预览与正式导入。
- 党团个人进度 Excel 导入预览与正式导入。
- 理论自测题库 Excel 导入预览与正式导入。
- 知识库查询、草稿创建、复核发布。
- 模板列表查询。
- 入党/入团流程配置与个人进度查询。
- 自测题目查询和答题记录提交。
- 公告通知录入、标签化目标分发、站内已读记录。
- 证明/盖章申请、附件上传、审批通过/驳回与审批记录。
- 操作日志记录。
- Kingbase/PostgreSQL 兼容数据库建表脚本。

## 2. 本地启动

进入后端目录：

```bash
cd backend
npm install
cp .env.example .env
```

修改 `.env`：

```text
DATABASE_URL=postgres://student_service:change_me@127.0.0.1:54321/student_service
DATABASE_SSL=false
JWT_SECRET=替换为长随机字符串
DATA_CRYPTO_KEY=替换为另一个长随机字符串
```

初始化数据库：

```bash
npm run db:init
```

启动服务：

```bash
npm run dev
```

健康检查：

```bash
curl http://127.0.0.1:8080/health
```

## 3. 小程序连接后端

编辑 `miniprogram/config/env.js`：

```js
module.exports = {
  apiBaseUrl: 'https://你的后端域名/api',
  tokenStorageKey: 'student_service_token'
}
```

微信小程序正式发布时，后端域名必须满足：

- 使用 HTTPS。
- 证书有效。
- 域名已在微信公众平台配置为 request 合法域名。

如果 `apiBaseUrl` 为空，小程序会继续使用本地 mock 数据，便于离线开发。

## 4. 数据库脚本

数据库脚本位于：

- `backend/db/schema.sql`
- `backend/db/seed.sql`

主要表：

- `students`：学生基础信息，敏感字段存储加密密文。
- `users`：微信账号、角色、额外权限。
- `knowledge_items`：知识库条目。
- `templates`：模板文件元数据。
- `process_stages`：党团流程配置。
- `process_progress`：学生个人党团进度。
- `quiz_questions`：理论自测题库。
- `quiz_records`：理论自测作答记录。
- `announcements` / `announcement_tags` / `announcement_targets` / `announcement_reads` / `announcement_deliveries`：公告与站内投递。
- `approval_requests` / `approval_attachments` / `approval_records`：证明和盖章审批。
- `operation_logs`：后台操作日志。
- `uploaded_files`：上传文件元数据。

人大金仓接入方式：

1. 在 Kingbase 中创建业务数据库和应用用户。
2. 确认该实例开启 PostgreSQL 兼容访问能力。
3. 将后端 `.env` 中的 `DATABASE_URL` 配为：

```text
DATABASE_URL=postgres://用户名:密码@数据库地址:端口/数据库名
```

如数据库网关要求 SSL，再设置：

```text
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

4. 运行 `npm run db:init` 写入表结构和初始化数据。
5. 小程序只配置后端 HTTPS 地址，不配置数据库地址。

正式录入学生个人信息时，优先使用 `/api/imports/students` 批量导入。模板位于 `templates/import/students_template.csv`，后端会按 `student_no` 新增或更新学生，并生成对应学号密码账号。

## 5. 关键接口

### 登录与账号绑定

```text
POST /api/auth/register
POST /api/auth/bind-student
POST /api/auth/password-login
POST /api/auth/change-password
GET  /api/profile/me
```

说明：

- `register` 创建账号后返回 Bearer token，未绑定账号只能进入学生身份绑定流程。
- `bind-student` 需要携带注册或登录接口返回的 Bearer token，后端从 token 中读取账号 ID，不信任前端传入的账号 ID。
- 同一学生信息被多个账号绑定时，后端保留注册时间较早的账号，禁用注册时间较新的账号，并返回较早账号的登录态。
- 学生导入时会自动生成默认账号，密码为 `INITIAL_STUDENT_PASSWORD` 对应的哈希值。
- 初始化数据内置独立超级管理员账号 `2024000001`，密码 `123456`，不绑定学生信息，角色为 `super_admin`，禁止通过修改密码接口改密。

### 知识库与模板

```text
GET  /api/knowledge?keyword=&category=
GET  /api/knowledge/categories
POST /api/knowledge/drafts
POST /api/knowledge/drafts/:id/publish
GET  /api/templates?category=
GET  /api/templates/categories
```

### 党团流程

```text
GET /api/processes/party/me
GET /api/processes/league/me
PUT /api/processes/stages
```

学生个人进度由负责老师、辅导员或超级管理员维护。一次活动导致多名学生进度变化时，使用导入接口批量更新 `process_progress`，不要让学生自行修改本人进度。

### 理论自测

```text
GET  /api/quiz/questions
POST /api/quiz/records
```

### 后台管理

```text
GET /api/admin/dashboard
GET /api/admin/logs
GET /api/admin/upload-policy
```

### 公告通知

```text
GET  /api/announcements?tag=&keyword=&unreadOnly=
POST /api/announcements/:id/read
GET  /api/announcements/manage
POST /api/announcements/manage
POST /api/announcements/:id/publish
POST /api/announcements/:id/withdraw
```

公告发布后会按目标条件写入站内投递记录。当前版本完成小程序站内通知，微信订阅消息和邮件发送仍需接入学院可用通道。

### 证明与审批

```text
GET  /api/approvals/mine
POST /api/approvals
POST /api/approvals/:id/attachments
POST /api/approvals/:id/submit
POST /api/approvals/:id/withdraw
GET  /api/approvals/manage
POST /api/approvals/:id/approve
POST /api/approvals/:id/reject
```

盖章申请应上传附件；涉密材料可在 `confidentialDescription` 中填写说明。驳回后学生可在原申请上修改并重新提交。

### 导入

```text
POST /api/imports/students/preview
POST /api/imports/students
POST /api/imports/process-progress/preview
POST /api/imports/process-progress
POST /api/imports/quiz/preview
POST /api/imports/quiz
```

导入接口使用 `multipart/form-data`，文件字段名为 `file`。

## 6. 导入模板

导入模板位于：

- `templates/import/students_template.csv`
- `templates/import/process_progress_template.csv`
- `templates/import/quiz_questions_template.csv`
- `templates/import/knowledge_items_template.csv`
- `templates/import/templates_metadata_template.csv`

后台页面可以直接提供这些模板的 Excel 版本下载，也可以读取 CSV 后转换成 Excel。

## 7. 生产注意事项

- 不要使用 `.env.example` 中的默认密钥。
- `JWT_SECRET` 和 `DATA_CRYPTO_KEY` 必须长期妥善保存，尤其是 `DATA_CRYPTO_KEY`，丢失后无法解密历史敏感字段。
- `INITIAL_STUDENT_PASSWORD` 用于学生导入和首次账号生成，生产环境应改为学院正式初始密码策略。
- 内置超级管理员账号 `2024000001` 仅用于初始化和课程演示；如进入真实生产环境，应改为受控密钥或线下交接策略。
- 当前版本暂不提供找回密码功能，生产环境应另行确定线下核验或后台重置流程。
- 文件上传建议接入学校内部对象存储或受控文件服务，不建议长期保存在应用服务器本地目录。
- 操作日志表应限制普通管理员删除权限。
- 敏感字段在导出、日志和错误报告中必须脱敏。
