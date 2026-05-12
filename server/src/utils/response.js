function success(res, data = null, message = 'ok', statusCode = 200) {
  return res.status(statusCode).json({ code: 0, message, data });
}

function error(res, message = 'Internal Server Error', statusCode = 500, code = -1) {
  return res.status(statusCode).json({ code, message, data: null });
}

function paginated(res, { list, total, page, pageSize }) {
  return res.json({
    code: 0,
    message: 'ok',
    data: { list, total, page, pageSize },
  });
}

module.exports = { success, error, paginated };
