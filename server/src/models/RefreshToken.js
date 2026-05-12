const { getDb } = require('../config/database');
const crypto = require('crypto');

const RefreshToken = {
  _db() { return getDb(); },

  generateAndStore({ userId, adminUserId, family }) {
    const token = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const tokenFamily = family || crypto.randomUUID();

    this._db().run(
      'INSERT INTO refresh_tokens (user_id, admin_user_id, token_hash, family, expires_at) VALUES (?, ?, ?, ?, ?)',
      [userId || null, adminUserId || null, tokenHash, tokenFamily, expiresAt]
    );

    return { token, family: tokenFamily };
  },

  findByHash(token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return this._db().get('SELECT * FROM refresh_tokens WHERE token_hash = ?', [hash]);
  },

  revoke(id) {
    this._db().run("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?", [id]);
  },

  revokeFamily(family) {
    this._db().run(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE family = ? AND revoked_at IS NULL",
      [family]
    );
  },

  cleanupExpired() {
    this._db().run("DELETE FROM refresh_tokens WHERE expires_at < datetime('now') OR revoked_at IS NOT NULL");
  },
};

module.exports = RefreshToken;
