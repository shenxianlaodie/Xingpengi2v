const { getDb } = require('../config/database');
const { sha256 } = require('../utils/hash');

function apiKeyAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  const key = header.split(' ')[1];

  if (!key.startsWith('sk-')) {
    return next();
  }

  const keyHash = sha256(key);
  const db = getDb();
  const apiKey = db.get(
    `SELECT ak.*, u.id as uid, u.role, u.status as user_status,
            u.quota_total, u.quota_used, u.daily_limit
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = ? AND ak.status = 'active'`,
    [keyHash]
  );

  if (!apiKey) {
    return res.status(401).json({ code: -1, message: 'API密钥无效', data: null });
  }

  if (apiKey.user_status !== 'active') {
    return res.status(403).json({ code: -1, message: '账号已被禁用', data: null });
  }

  req.user = { userId: apiKey.uid, role: apiKey.role, apiKeyId: apiKey.id };
  next();
}

module.exports = apiKeyAuth;
