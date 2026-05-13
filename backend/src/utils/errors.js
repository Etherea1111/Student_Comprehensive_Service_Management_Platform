class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message)
    this.statusCode = statusCode
    this.details = details
  }
}

function badRequest(message, details) {
  return new AppError(400, message, details)
}

function unauthorized(message = 'Unauthorized') {
  return new AppError(401, message)
}

function forbidden(message = 'Forbidden') {
  return new AppError(403, message)
}

function notFound(message = 'Not found') {
  return new AppError(404, message)
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound
}
