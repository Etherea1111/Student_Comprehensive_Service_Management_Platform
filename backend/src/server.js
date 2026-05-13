const app = require('./app')
const env = require('./config/env')

app.listen(env.port, () => {
  console.log(`Student service backend listening on port ${env.port}`)
})
