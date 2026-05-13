# 后端部署与接口说明

## 1. 后端能力范围

当前仓库已包含可继续落地部署的 Node.js 后端骨架，覆盖以下能力：

- 微信登录与学生实名绑定接口。
- JWT 登录态。
- 角色权限校验。
- 学生信息 Excel 导入预览与正式导入。
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

## 5. 关键接口

### 登录与账号绑定

```text
POST /api/auth/wechat-login
POST /api/auth/bind-student
GET  /api/profile/me
```

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
POST /api/imports/quiz/preview
POST /api/imports/quiz
```

导入接口使用 `multipart/form-data`，文件字段名为 `file`。

## 6. 导入模板

导入模板位于：

- `templates/import/students_template.csv`
- `templates/import/quiz_questions_template.csv`
- `templates/import/knowledge_items_template.csv`
- `templates/import/templates_metadata_template.csv`

后台页面可以直接提供这些模板的 Excel 版本下载，也可以读取 CSV 后转换成 Excel。

## 7. 生产注意事项

- 不要使用 `.env.example` 中的默认密钥。
- `JWT_SECRET` 和 `DATA_CRYPTO_KEY` 必须长期妥善保存，尤其是 `DATA_CRYPTO_KEY`，丢失后无法解密历史敏感字段。
- 微信登录当前保留了本地 mock code 兜底，生产环境应调用微信 `jscode2session` 接口并校验返回结果。
- 文件上传建议接入学校内部对象存储或受控文件服务，不建议长期保存在应用服务器本地目录。
- 操作日志表应限制普通管理员删除权限。
- 敏感字段在导出、日志和错误报告中必须脱敏。
