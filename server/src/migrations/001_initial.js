exports.up = (db) => {
  db.exec(`
    CREATE TABLE users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT    NOT NULL UNIQUE,
      email           TEXT    NOT NULL UNIQUE,
      password_hash   TEXT    NOT NULL,
      role            TEXT    NOT NULL DEFAULT 'user',
      avatar_url      TEXT,
      quota_total     INTEGER NOT NULL DEFAULT 100,
      quota_used      INTEGER NOT NULL DEFAULT 0,
      daily_limit     INTEGER NOT NULL DEFAULT 50,
      status          TEXT    NOT NULL DEFAULT 'active',
      last_login_ip   TEXT,
      last_login_at   TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE api_keys (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash        TEXT    NOT NULL UNIQUE,
      key_prefix      TEXT    NOT NULL,
      name            TEXT    NOT NULL DEFAULT 'Default',
      quota_limit     INTEGER,
      quota_used      INTEGER NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'active',
      last_used_at    TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      expires_at      TEXT
    );

    CREATE TABLE usage_logs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      api_key_id        INTEGER REFERENCES api_keys(id),
      endpoint          TEXT    NOT NULL,
      model             TEXT,
      request_type      TEXT    NOT NULL,
      prompt_tokens     INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      image_count       INTEGER DEFAULT 0,
      video_duration    INTEGER DEFAULT 0,
      status            TEXT    NOT NULL DEFAULT 'pending',
      error_message     TEXT,
      cost              REAL    NOT NULL DEFAULT 0,
      tuzi_task_id      TEXT,
      tuzi_request_id   TEXT,
      ip_address        TEXT,
      user_agent        TEXT,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
    CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
    CREATE INDEX idx_usage_logs_tuzi_task_id ON usage_logs(tuzi_task_id);

    CREATE TABLE generated_assets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      usage_log_id    INTEGER REFERENCES usage_logs(id),
      asset_type      TEXT    NOT NULL,
      prompt          TEXT,
      source_url      TEXT,
      cached_path     TEXT,
      file_size       INTEGER,
      width           INTEGER,
      height          INTEGER,
      duration        INTEGER,
      mime_type       TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending',
      is_public       INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE admin_users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT    NOT NULL UNIQUE,
      email           TEXT    NOT NULL UNIQUE,
      password_hash   TEXT    NOT NULL,
      role            TEXT    NOT NULL DEFAULT 'admin',
      permissions     TEXT    DEFAULT '{}',
      created_by      INTEGER REFERENCES admin_users(id),
      status          TEXT    NOT NULL DEFAULT 'active',
      last_login_ip   TEXT,
      last_login_at   TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE system_config (
      key             TEXT PRIMARY KEY,
      value           TEXT    NOT NULL,
      description     TEXT,
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE webhook_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      tuzi_task_id    TEXT    NOT NULL,
      payload         TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'received',
      processing_error TEXT,
      received_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      processed_at    TEXT
    );

    CREATE TABLE refresh_tokens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER REFERENCES users(id),
      admin_user_id   INTEGER REFERENCES admin_users(id),
      token_hash      TEXT    NOT NULL UNIQUE,
      family          TEXT    NOT NULL,
      expires_at      TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      revoked_at      TEXT
    );

    -- Seed default system config
    INSERT OR IGNORE INTO system_config (key, value, description) VALUES
      ('tuzi_base_url', 'https://api.tu-zi.com', 'AI API基础地址'),
      ('tuzi_api_key', '', 'AI API主密钥'),
      ('cost_image_per_call', '0.1', '图片生成每次费用(RMB)'),
      ('cost_video_per_second', '0.05', '视频生成每秒费用(RMB)'),
      ('registration_open', 'true', '是否允许新用户注册'),
      ('webhook_secret', '', 'Webhook签名密钥'),
      ('dingtalk_app_key', '', '钉钉应用AppKey'),
      ('dingtalk_app_secret', '', '钉钉应用AppSecret');

    -- Create default super admin (password: admin123)
    INSERT OR IGNORE INTO admin_users (username, email, password_hash, role, permissions) VALUES
      ('兴鹏', '13720211675@163.com', '$2a$10$TEVLUlr3yAU3YeY52n7/3e4m8T3Y60gz1Y6EwoVbHMkiSu9OLx3lC',
       'super_admin', '{"manage_users":true,"view_logs":true,"manage_config":true,"manage_admins":true}');
  `);
};
