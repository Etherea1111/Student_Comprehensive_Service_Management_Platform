const crypto = require('crypto')

const algorithm = 'aes-256-gcm'

function getKey() {
  const raw = process.env.DATA_CRYPTO_KEY || process.env.JWT_SECRET || 'dev-only-data-secret'
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptField(value) {
  const text = String(value || '')
  if (!text) {
    return ''
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

function decryptField(value) {
  if (!value) {
    return ''
  }
  const [ivText, tagText, encryptedText] = String(value).split('.')
  if (!ivText || !tagText || !encryptedText) {
    return ''
  }
  const decipher = crypto.createDecipheriv(algorithm, getKey(), Buffer.from(ivText, 'base64'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final()
  ])
  return decrypted.toString('utf8')
}

function maskIdCard(value) {
  const text = String(value || '')
  if (text.length <= 10) {
    return text ? '******' : ''
  }
  return `${text.slice(0, 6)}********${text.slice(-4)}`
}

function maskPhone(value) {
  const text = String(value || '')
  if (text.length < 7) {
    return text ? '****' : ''
  }
  return `${text.slice(0, 3)}****${text.slice(-4)}`
}

module.exports = {
  encryptField,
  decryptField,
  maskIdCard,
  maskPhone
}
