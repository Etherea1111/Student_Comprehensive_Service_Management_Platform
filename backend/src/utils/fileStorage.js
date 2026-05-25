const fs = require('fs')
const path = require('path')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function normalizeStoredPath(filePath) {
  return path.normalize(filePath)
}

function isSafeStoredPath(filePath, allowedRoot) {
  const normalizedFilePath = path.resolve(normalizeStoredPath(filePath))
  const normalizedRoot = path.resolve(allowedRoot)
  return normalizedFilePath === normalizedRoot || normalizedFilePath.startsWith(`${normalizedRoot}${path.sep}`)
}

function getDownloadName(originalName, fallback = 'download') {
  const safeName = path.basename(String(originalName || '').trim())
  return safeName || fallback
}

module.exports = {
  ensureDir,
  normalizeStoredPath,
  isSafeStoredPath,
  getDownloadName
}
