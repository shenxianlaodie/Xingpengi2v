const { getDb } = require('../config/database');

const User = {
  _db() { return getDb(); },

  findById(id) {
    return this._db().prepare('SELECT id, username, email, role, avatar_url, quota_total, quota_used, daily_limit, status, last_login_ip, last_login_at, created_at, updated_at FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return this._db().get('SELECT * FROM users WHERE email = ?', [email]);
  },

  findByUsername(username) {
    return this._db().get('SELECT * FROM users WHERE username = ?', [username]);
  },

  create({ username, email, passwordHash }) {
    const db = this._db();
    db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );
    // Use a direct id lookup since lastInsertRowid may be unreliable
    const user = db.get(
      'SELECT id, username, email, role, avatar_url, quota_total, quota_used, daily_limit, status, last_login_ip, last_login_at, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );
    return user;
  },

  updateLogin(id, ip) {
    this._db().run(
      "UPDATE users SET last_login_ip = ?, last_login_at = datetime('now') WHERE id = ?",
      [ip, id]
    );
  },

  incrementQuota(id, amount = 1) {
    this._db().run('UPDATE users SET quota_used = quota_used + ? WHERE id = ?', [amount, id]);
  },

  setQuota(id, total, dailyLimit) {
    this._db().run(
      "UPDATE users SET quota_total = ?, daily_limit = ?, updated_at = datetime('now') WHERE id = ?",
      [total, dailyLimit, id]
    );
  },

  setStatus(id, status) {
    this._db().run(
      "UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, id]
    );
  },

  updateProfile(id, { username, avatar_url }) {
    this._db().run(
      "UPDATE users SET username = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?",
      [username, avatar_url, id]
    );
  },

  changePassword(id, passwordHash) {
    this._db().run(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
      [passwordHash, id]
    );
  },

  list({ page = 1, pageSize = 20, search = '', status = '', excludeAdmins = false }) {
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('(username LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (excludeAdmins) {
      conditions.push('email NOT IN (SELECT email FROM admin_users)');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = this._db().get(`SELECT COUNT(*) as cnt FROM users ${where}`, params)?.cnt || 0;
    const list = this._db().exec(
      `SELECT id, username, email, role, quota_total, quota_used, daily_limit, status, last_login_ip, last_login_at, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { list, total };
  },

  delete(id) {
    this._db().run('DELETE FROM users WHERE id = ?', [id]);
  },

  countTotal() {
    return this._db().get('SELECT COUNT(*) as cnt FROM users')?.cnt || 0;
  },

  findByDingtalkUnionId(unionId) {
    return this._db().get('SELECT * FROM users WHERE dingtalk_union_id = ?', [unionId]);
  },

  findByDingtalkOpenId(openId) {
    return this._db().get('SELECT * FROM users WHERE dingtalk_open_id = ?', [openId]);
  },

  updateDingtalk(id, { unionId, openId, nick, avatar }) {
    this._db().run(
      "UPDATE users SET dingtalk_union_id = ?, dingtalk_open_id = ?, dingtalk_nick = ?, dingtalk_avatar = ?, updated_at = datetime('now') WHERE id = ?",
      [unionId || null, openId || null, nick || null, avatar || null, id]
    );
  },

  createFromDingtalk({ username, email, unionId, openId, nick, avatar }) {
    const db = this._db();
    // Ensure unique username
    let finalUsername = username;
    let suffix = 0;
    while (db.get('SELECT id FROM users WHERE username = ?', [finalUsername])) {
      suffix++;
      finalUsername = `${username}_${suffix}`;
    }
    db.run(
      `INSERT INTO users (username, email, password_hash, dingtalk_union_id, dingtalk_open_id, dingtalk_nick, dingtalk_avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [finalUsername, email, '', unionId || null, openId || null, nick || null, avatar || null]
    );
    return db.get(
      'SELECT id, username, email, role, avatar_url, quota_total, quota_used, daily_limit, status, last_login_ip, last_login_at, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );
  },

  getStats() {
    const db = this._db();
    const totalUsers = db.get("SELECT COUNT(*) as cnt FROM users WHERE role = 'user'")?.cnt || 0;
    const todayCalls = db.get("SELECT COUNT(*) as cnt FROM usage_logs WHERE date(created_at) = date('now')")?.cnt || 0;
    const todayCost = db.get("SELECT COALESCE(SUM(cost), 0) as total FROM usage_logs WHERE date(created_at) = date('now')")?.total || 0;
    const pendingTasks = db.get("SELECT COUNT(*) as cnt FROM usage_logs WHERE status IN ('pending','processing')")?.cnt || 0;
    return { totalUsers, todayCalls, todayCost, pendingTasks };
  },
};

module.exports = User;
