const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const env = require('./config/env')
const errorHandler = require('./middlewares/errorHandler')

const authRoutes = require('./routes/authRoutes')
const profileRoutes = require('./routes/profileRoutes')
const knowledgeRoutes = require('./routes/knowledgeRoutes')
const templateRoutes = require('./routes/templateRoutes')
const processRoutes = require('./routes/processRoutes')
const quizRoutes = require('./routes/quizRoutes')
const adminRoutes = require('./routes/adminRoutes')
const importRoutes = require('./routes/importRoutes')
const announcementRoutes = require('./routes/announcementRoutes')
const approvalRoutes = require('./routes/approvalRoutes')

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin
  })
)
app.use(express.json({ limit: '2mb' }))

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use(`${env.apiBasePath}/auth`, authRoutes)
app.use(`${env.apiBasePath}/profile`, profileRoutes)
app.use(`${env.apiBasePath}/knowledge`, knowledgeRoutes)
app.use(`${env.apiBasePath}/templates`, templateRoutes)
app.use(`${env.apiBasePath}/processes`, processRoutes)
app.use(`${env.apiBasePath}/quiz`, quizRoutes)
app.use(`${env.apiBasePath}/admin`, adminRoutes)
app.use(`${env.apiBasePath}/imports`, importRoutes)
app.use(`${env.apiBasePath}/announcements`, announcementRoutes)
app.use(`${env.apiBasePath}/approvals`, approvalRoutes)

app.use(errorHandler)

module.exports = app
