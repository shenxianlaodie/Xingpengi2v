const { getDb } = require('../config/database');

const GeneratedAsset = {
  _db() { return getDb(); },

  create({ userId, usageLogId, assetType, prompt, sourceUrl, cachedPath,
           fileSize, width, height, duration, mimeType, status }) {
    const result = this._db().run(
      `INSERT INTO generated_assets (user_id, usage_log_id, asset_type, prompt, source_url,
        cached_path, file_size, width, height, duration, mime_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, usageLogId || null, assetType, prompt || null, sourceUrl || null,
        cachedPath || null, fileSize || null, width || null, height || null,
        duration || null, mimeType || null, status || 'pending']
    );
    return this.findById(result.lastInsertRowid);
  },

  findById(id) {
    return this._db().get('SELECT * FROM generated_assets WHERE id = ?', [id]);
  },

  findByUserId(userId, { page = 1, pageSize = 20, type, role } = {}) {
    const conditions = [];
    const params = [];
    const isAdminRole = role === 'admin' || role === 'super_admin';
    if (isAdminRole) {
      conditions.push('user_id IS NULL');
    } else {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (type) { conditions.push('asset_type = ?'); params.push(type); }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const total = this._db().get(`SELECT COUNT(*) as cnt FROM generated_assets ${where}`, params)?.cnt || 0;
    const list = this._db().exec(
      `SELECT * FROM generated_assets ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { list, total };
  },

  findByTuziTaskId(tuziTaskId) {
    return this._db().exec(
      `SELECT ga.* FROM generated_assets ga
       JOIN usage_logs ul ON ga.usage_log_id = ul.id
       WHERE ul.tuzi_task_id = ?`,
      [tuziTaskId]
    );
  },

  updateStatus(id, status, cachedPath, fileSize, width, height, duration, mimeType) {
    this._db().run(
      `UPDATE generated_assets SET status = ?, cached_path = COALESCE(?, cached_path),
        file_size = COALESCE(?, file_size), width = COALESCE(?, width),
        height = COALESCE(?, height), duration = COALESCE(?, duration),
        mime_type = COALESCE(?, mime_type)
       WHERE id = ?`,
      [status, cachedPath || null, fileSize || null, width || null,
       height || null, duration || null, mimeType || null, id]
    );
  },

  deleteById(id, userId, role) {
    const isAdminRole = role === 'admin' || role === 'super_admin';
    if (isAdminRole) {
      this._db().run('DELETE FROM generated_assets WHERE id = ? AND user_id IS NULL', [id]);
    } else {
      this._db().run('DELETE FROM generated_assets WHERE id = ? AND user_id = ?', [id, userId]);
    }
  },

  adminDelete(id) {
    this._db().run('DELETE FROM generated_assets WHERE id = ?', [id]);
  },

  listAll({ page = 1, pageSize = 20, userId, type }) {
    const conditions = [];
    const params = [];
    if (userId) { conditions.push('ga.user_id = ?'); params.push(userId); }
    if (type) { conditions.push('ga.asset_type = ?'); params.push(type); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = this._db().get(`SELECT COUNT(*) as cnt FROM generated_assets ga ${where}`, params)?.cnt || 0;
    const list = this._db().exec(
      `SELECT ga.*, u.username FROM generated_assets ga
       JOIN users u ON ga.user_id = u.id
       ${where} ORDER BY ga.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { list, total };
  },
};

module.exports = GeneratedAsset;
