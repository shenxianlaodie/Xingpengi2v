exports.up = (db) => {
  // Allow usage_logs to be created without a regular user (for admin usage)
  db.exec(`
    CREATE TABLE usage_logs_new (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER REFERENCES users(id),
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

    INSERT INTO usage_logs_new SELECT * FROM usage_logs;
    DROP TABLE usage_logs;
    ALTER TABLE usage_logs_new RENAME TO usage_logs;

    CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_tuzi_task_id ON usage_logs(tuzi_task_id);
  `);
};
