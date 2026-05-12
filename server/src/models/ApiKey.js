const { getDb } = require('../config/database');
const crypto = require('crypto');

const ApiKey = {
  _db() { return getDb(); },

  create(userId, name = 'Default') {
    const rawKey = `sk-${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.substring(0, 11);

    this._db().run(
      'INSERT INTO api_keys (user_id, key_hash, key_prefix, name) VALUES (?, ?, ?, ?)',
      [userId, keyHash, prefix, name]
    );

    return { rawKey, prefix };
  },

  findByUserId(userId) {
    return this._db().exec(
      `SELECT id, key_prefix, name, quota_used, status, last_used_at, created_at, expires_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
  },

  findByIdForUser(id, userId) {
    return this._db().get('SELECT * FROM api_keys WHERE id = ? AND user_id = ?', [id, userId]);
  },

  revoke(id) {
    this._db().run("UPDATE api_keys SET status = 'revoked' WHERE id = ?", [id]);
  },

  recordUsage(id) {
    this._db().run("UPDATE api_keys SET quota_used = quota_used + 1, last_used_at = datetime('now') WHERE id = ?", [id]);
  },
};

module.exports = ApiKey;
