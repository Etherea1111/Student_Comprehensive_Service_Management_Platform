# 后端部署与接口说明

## 1. 后端能力范围

当前仓库已包含可继续落地部署的 Node.js 后端骨架，覆盖以下能力：

- 微信登录与学生实名绑定接口。
- 学号密码登录、修改密码、找回密码接口。
- JWT 登录态。
- 角色权限校验。
- 学生信息 Excel 导入预览与正式导入。
- 党团个人进度 Excel 导入预览与正式导入。
- 理论自测题库 Excel 导入预览与正式导入。
- 知识库查询、草稿创建、复核发布。
- 模板列表查询。
- 入党/入团流程配置与个人进度查询。
- 自测题目查询和答题记录提交。
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
WECHAT_APP_ID=真实微信小程序 AppID
WECHAT_APP_SECRET=真实微信小程序 AppSecret
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
POST /api/auth/wechat-login
POST /api/auth/bind-student
POST /api/auth/password-login
POST /api/auth/change-password
POST /api/auth/password-reset/request
POST /api/auth/password-reset/confirm
GET  /api/profile/me
```

说明：

- `bind-student` 需要携带微信登录接口返回的 Bearer token，后端从 token 中读取 openid，不信任前端传入的 openid。
- 学号密码登录的账号固定为 10 位数字学号。
- 学生导入时会自动生成学号账号，密码为 `INITIAL_STUDENT_PASSWORD` 对应的哈希值。

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
- 微信登录已支持调用微信 `jscode2session`；未配置 AppID/Secret 或使用 mock code 时才会进入本地开发兜底。
- `INITIAL_STUDENT_PASSWORD` 用于学生导入和首次账号生成，生产环境应改为学院正式初始密码策略。
- 找回密码接口在非生产环境会返回重置凭证，生产环境不返回凭证，应改为通过学院确认渠道、短信、邮件或后台审核方式发送。
- 文件上传建议接入学校内部对象存储或受控文件服务，不建议长期保存在应用服务器本地目录。
- 操作日志表应限制普通管理员删除权限。
- 敏感字段在导出、日志和错误报告中必须脱敏。
