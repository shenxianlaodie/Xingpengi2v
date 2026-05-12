exports.up = (db) => {
  // Add DingTalk columns to users table
  db.exec(`
    ALTER TABLE users ADD COLUMN dingtalk_union_id TEXT;
    ALTER TABLE users ADD COLUMN dingtalk_open_id TEXT;
    ALTER TABLE users ADD COLUMN dingtalk_nick TEXT;
    ALTER TABLE users ADD COLUMN dingtalk_avatar TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dingtalk_union_id ON users(dingtalk_union_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dingtalk_open_id ON users(dingtalk_open_id);
  `);

  // Seed DingTalk config entries
  db.run(
    `INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)`,
    ['dingtalk_app_key', '', '钉钉应用AppKey']
  );
  db.run(
    `INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)`,
    ['dingtalk_app_secret', '', '钉钉应用AppSecret']
  );
};
