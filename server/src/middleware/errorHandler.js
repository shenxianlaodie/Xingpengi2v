function errorHandler(err, req, res, _next) {
  console.error(`[error] ${err.message}`, err.stack);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: -1, message: '请求体JSON格式错误', data: null });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ code: -1, message: '文件大小超过限制', data: null });
  }

  res.status(500).json({ code: -1, message: '服务器内部错误', data: null });
}

module.exports = errorHandler;
