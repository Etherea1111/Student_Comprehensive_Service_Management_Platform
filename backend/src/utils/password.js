const crypto = require('crypto')

const iterations = 120000
const keyLength = 64
const digest = 'sha512'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, keyLength, digest).toString('hex')
  return `pbkdf2$${iterations}$${salt}$${hash}`
}

function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false
  }
  const [scheme, iterText, salt, expectedHash] = String(storedHash).split('$')
  if (scheme !== 'pbkdf2' || !iterText || !salt || !expectedHash) {
    return false
  }
  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterText), keyLength, digest)
    .toString('hex')
  return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'))
}

function validateStudentNo(studentNo) {
  return /^\d{10}$/.test(String(studentNo || ''))
}

function validatePassword(password) {
  const text = String(password || '')
  return text.length >= 8 && text.length <= 64
}

module.exports = {
  hashPassword,
  verifyPassword,
  validateStudentNo,
  validatePassword
}
