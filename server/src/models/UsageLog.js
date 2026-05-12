const { getDb } = require('../config/database');

const UsageLog = {
  _db() { return getDb(); },

  create({ userId, apiKeyId, endpoint, model, requestType, promptTokens, completionTokens,
           imageCount, videoDuration, status, errorMessage, cost, tuziTaskId, tuziRequestId, ipAddress, userAgent }) {
    const result = this._db().run(
      `INSERT INTO usage_logs (user_id, api_key_id, endpoint, model, request_type,
        prompt_tokens, completion_tokens, image_count, video_duration, status, error_message, cost,
        tuzi_task_id, tuzi_request_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, apiKeyId || null, endpoint, model || null, requestType,
        promptTokens || 0, completionTokens || 0, imageCount || 0, videoDuration || 0,
        status || 'success', errorMessage || null, cost || 0, tuziTaskId || null, tuziRequestId || null,
        ipAddress || null, userAgent || null]
    );
    return this.findById(result.lastInsertRowid);
  },

  findById(id) {
    return this._db().get('SELECT * FROM usage_logs WHERE id = ?', [id]);
  },

  findByTuziTaskId(taskId) {
    return this._db().get('SELECT * FROM usage_logs WHERE tuzi_task_id = ?', [taskId]);
  },

  updateStatus(id, status, errorMessage) {
    this._db().run(
      'UPDATE usage_logs SET status = ?, error_message = ? WHERE id = ?',
      [status, errorMessage || null, id]
    );
  },

  findPendingAsync() {
    return this._db().exec(
      `SELECT * FROM usage_logs
       WHERE status IN ('pending', 'processing') AND tuzi_task_id IS NOT NULL
       ORDER BY created_at ASC`
    );
  },

  list({ page = 1, pageSize = 20, userId, requestType, status, startDate, endDate }) {
    const conditions = [];
    const params = [];
    if (userId) { conditions.push('ul.user_id = ?'); params.push(userId); }
    if (requestType) { conditions.push('ul.request_type = ?'); params.push(requestType); }
    if (status) { conditions.push('ul.status = ?'); params.push(status); }
    if (startDate) { conditions.push('ul.created_at >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('ul.created_at <= ?'); params.push(endDate); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = this._db().get(`SELECT COUNT(*) as cnt FROM usage_logs ul ${where}`, params)?.cnt || 0;
    const list = this._db().exec(
      `SELECT ul.*, u.username, u.email
       FROM usage_logs ul
       JOIN users u ON ul.user_id = u.id
       ${where}
       ORDER BY ul.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { list, total };
  },

  getUserStats(userId, days = 30) {
    return this._db().exec(
      `SELECT date(created_at) as day, request_type as type, COUNT(*) as count, SUM(cost) as cost
       FROM usage_logs
       WHERE user_id = ? AND created_at >= datetime('now', ?)
       GROUP BY date(created_at), request_type
       ORDER BY day ASC`,
      [userId, `-${days} days`]
    );
  },

  getDailyStats(days = 30) {
    return this._db().exec(
      `SELECT date(created_at) as day, request_type as type, COUNT(*) as count, SUM(cost) as cost
       FROM usage_logs
       WHERE created_at >= datetime('now', ?)
       GROUP BY date(created_at), request_type
       ORDER BY day ASC`,
      [`-${days} days`]
    );
  },

  getTopUsers(limit = 10, days = 30) {
    return this._db().exec(
      `SELECT u.username, COUNT(*) as count, SUM(ul.cost) as total_cost
       FROM usage_logs ul
       JOIN users u ON ul.user_id = u.id
       WHERE ul.created_at >= datetime('now', ?)
       GROUP BY ul.user_id
       ORDER BY count DESC
       LIMIT ?`,
      [`-${days} days`, limit]
    );
  },
};

module.exports = UsageLog;
