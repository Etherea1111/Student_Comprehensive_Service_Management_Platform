const jwt = require('jsonwebtoken')
const env = require('../config/env')
const { unauthorized, forbidden } = require('../utils/errors')

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
    'approve_requests',
    'import_students',
    'import_quiz',
    'manage_permissions',
    'view_operation_records'
  ],
  college_leader: ['read_public', 'read_sensitive', 'view_statistics', 'view_operation_records'],
  super_admin: ['manage_all']
}

function resolvePermissions(role, extraPermissions = []) {
  const permissions = new Set([...(rolePermissions[role] || []), ...extraPermissions])
  if (permissions.has('manage_all')) {
    permissions.add('read_public')
    permissions.add('read_own_progress')
    permissions.add('quiz')
    permissions.add('read_sensitive')
    permissions.add('audit_content')
    permissions.add('manage_public_content')
    permissions.add('manage_process')
    permissions.add('approve_requests')
    permissions.add('import_students')
    permissions.add('import_quiz')
    permissions.add('manage_permissions')
    permissions.add('manage_accounts')
    permissions.add('view_statistics')
    permissions.add('view_operation_records')
  }
  return Array.from(permissions)
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    next(unauthorized('Missing bearer token'))
    return
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    req.user = {
      id: payload.sub,
      accountName: payload.accountName,
      studentNo: payload.studentNo,
      name: payload.name,
      role: payload.role || 'student',
      passwordChangeDisabled: Boolean(payload.passwordChangeDisabled),
      permissions: resolvePermissions(payload.role || 'student', payload.permissions || [])
    }
    if (!req.user.studentNo && req.user.role === 'student') {
      req.user.permissions = ['read_public']
    }
    next()
  } catch (error) {
    next(unauthorized('Invalid or expired token'))
  }
}

function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    next()
    return
  }
  authenticate(req, res, next)
}

function requirePermission(permission) {
  return function permissionMiddleware(req, res, next) {
    const permissions = (req.user && req.user.permissions) || []
    if (!permissions.includes(permission) && !permissions.includes('manage_all')) {
      next(forbidden(`Permission required: ${permission}`))
      return
    }
    next()
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requirePermission,
  resolvePermissions,
  rolePermissions
}
