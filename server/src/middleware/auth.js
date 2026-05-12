const { verifyAccessToken } = require('../utils/jwt');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: -1, message: '未提供认证令牌', data: null });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ code: -1, message: '令牌无效或已过期', data: null });
  }
}

module.exports = auth;
