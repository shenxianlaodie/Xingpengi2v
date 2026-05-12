const { getDb } = require('../config/database');

const cache = new Map();
let cacheLoaded = false;

function loadCache() {
  const db = getDb();
  const rows = db.exec('SELECT key, value FROM system_config');
  for (const row of rows) {
    cache.set(row.key, row.value);
  }
  cacheLoaded = true;
}

const SystemConfig = {
  get(key, defaultValue = '') {
    if (!cacheLoaded) loadCache();
    return cache.has(key) ? cache.get(key) : defaultValue;
  },

  set(key, value, description) {
    const db = getDb();
    db.run(
      `INSERT INTO system_config (key, value, description, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
       description = COALESCE(excluded.description, description),
       updated_at = datetime('now')`,
      [key, value, description || null]
    );
    cache.set(key, value);
    db.save();
  },

  getAll() {
    return getDb().exec('SELECT * FROM system_config ORDER BY key');
  },

  delete(key) {
    getDb().run('DELETE FROM system_config WHERE key = ?', [key]);
    cache.delete(key);
  },
};

module.exports = SystemConfig;
