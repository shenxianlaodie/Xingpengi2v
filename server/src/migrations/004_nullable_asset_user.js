exports.up = (db) => {
  // Recreate generated_assets with nullable user_id (admins may have null user_id)
  db.exec(`
    CREATE TABLE generated_assets_new (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER REFERENCES users(id),
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

    INSERT INTO generated_assets_new SELECT * FROM generated_assets;
    DROP TABLE generated_assets;
    ALTER TABLE generated_assets_new RENAME TO generated_assets;
  `);
};
