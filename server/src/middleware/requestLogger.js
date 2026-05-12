function requestLogger(req, res, next) {
  req.requestInfo = {
    ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'] || '',
  };
  next();
}

module.exports = requestLogger;
