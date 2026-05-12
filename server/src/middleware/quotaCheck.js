const { getDb } = require('../config/database');

function quotaCheck(req, res, next) {
  const userId = req.user.userId;
  const db = getDb();

  // Admins bypass quota checks
  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    return next();
  }

  const user = db.get(
    'SELECT quota_total, quota_used, daily_limit, status FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    return res.status(403).json({ code: -1, message: '用户不存在', data: null });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ code: -1, message: '账号已被禁用', data: null });
  }

  if (user.quota_used >= user.quota_total) {
    return res.status(429).json({ code: -1, message: '配额已用完', data: null });
  }

  const todayCalls = db.get(
    "SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id = ? AND date(created_at) = date('now')",
    [userId]
  );

  if (todayCalls && todayCalls.cnt >= user.daily_limit) {
    return res.status(429).json({ code: -1, message: '今日调用次数已达上限', data: null });
  }

  next();
}

module.exports = quotaCheck;
