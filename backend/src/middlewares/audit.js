const auditService = require('../services/auditService')

function audit(action, targetTypeResolver) {
  return async function auditMiddleware(req, res, next) {
    const originalJson = res.json.bind(res)
    res.json = function patchedJson(body) {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const targetType =
          typeof targetTypeResolver === 'function' ? targetTypeResolver(req, body) : targetTypeResolver
        auditService
          .record({
            operator: req.user,
            action,
            targetType,
            targetId: body && body.id ? body.id : undefined,
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent']
          })
          .catch(() => {})
      }
      return originalJson(body)
    }
    next()
  }
}

module.exports = audit
