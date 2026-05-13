require('dotenv').config()

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8080),
  apiBasePath: process.env.API_BASE_PATH || '/api',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  wechatAppId: process.env.WECHAT_APP_ID || '',
  wechatAppSecret: process.env.WECHAT_APP_SECRET || '',
  uploadDir: process.env.UPLOAD_DIR || 'uploads/files',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 30),
  corsOrigin: process.env.CORS_ORIGIN || '*'
}

module.exports = env
