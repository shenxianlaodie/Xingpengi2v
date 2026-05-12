const { getDb } = require('../config/database');
const bcrypt = require('bcryptjs');

const AdminUser = {
  _db() { return getDb(); },

  findById(id) {
    return this._db().get(
      'SELECT id, username, email, role, permissions, status, created_by, last_login_ip, last_login_at, created_at FROM admin_users WHERE id = ?',
      [id]
    );
  },

  findByIdWithPassword(id) {
    return this._db().get('SELECT * FROM admin_users WHERE id = ?', [id]);
  },

  findByEmail(email) {
    return this._db().get('SELECT * FROM admin_users WHERE email = ?', [email]);
  },

  async create({ username, email, password, role, permissions, createdBy }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = this._db().run(
      'INSERT INTO admin_users (username, email, password_hash, role, permissions, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, role || 'admin', JSON.stringify(permissions || {}), createdBy || null]
    );
    return this.findById(result.lastInsertRowid);
  },

  updateLogin(id, ip) {
    this._db().run(
      "UPDATE admin_users SET last_login_ip = ?, last_login_at = datetime('now') WHERE id = ?",
      [ip, id]
    );
  },

  list() {
    return this._db().exec(
      `SELECT id, username, email, role, permissions, status, created_by, last_login_ip, last_login_at, created_at
       FROM admin_users ORDER BY created_at ASC`
    );
  },

  update(id, { username, email, role, permissions, status }) {
    const fields = [];
    const params = [];
    if (username !== undefined) { fields.push('username = ?'); params.push(username); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
    if (permissions !== undefined) { fields.push('permissions = ?'); params.push(JSON.stringify(permissions)); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    params.push(id);
    this._db().run(`UPDATE admin_users SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  delete(id) {
    this._db().run('DELETE FROM admin_users WHERE id = ?', [id]);
  },
};

module.exports = AdminUser;
