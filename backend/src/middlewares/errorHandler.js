const { AppError } = require('../utils/errors')

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error)
    return
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500
  const payload = {
    error: {
      message: statusCode === 500 ? 'Internal server error' : error.message
    }
  }

  if (error.details) {
    payload.error.details = error.details
  }

  if (statusCode === 500 && process.env.NODE_ENV !== 'production') {
    payload.error.debug = error.message
  }

  res.status(statusCode).json(payload)
}

module.exports = errorHandler
