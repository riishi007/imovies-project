
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode < 600
      ? err.statusCode
      : Number.isInteger(err.status) &&
          err.status >= 400 &&
          err.status < 600
        ? err.status
        : 500;

  // Log server errors without exposing internal details to clients.
  if (statusCode >= 500) {
    console.error('Server error:', err);
  }

  return res.status(statusCode).json({
    message:
      statusCode >= 500
        ? 'Internal server error.'
        : err.message || 'Request failed.',
  });
}

module.exports = errorHandler;
