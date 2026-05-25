const path = require('path');
const fs = require('fs');
const config = require('./index');

let db = null;

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(path.resolve(config.uploadDir, 'images'));
ensureDir(path.resolve(config.uploadDir, 'videos'));

// Save database to disk
function saveToDisk() {
  if (!db || !db._db) return;
  const data = db._db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.dbPath, buffer);
}

// Auto-save every 30 seconds
let saveInterval = null;

async function initDatabase() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  // Create wrapper
  db = {
    _db: sqlDb,

    run(sql, params = []) {
      sqlDb.run(sql, params);
      const rawResults = sqlDb.exec('SELECT last_insert_rowid()');
      const rowid = (rawResults.length > 0 && rawResults[0].values.length > 0)
        ? rawResults[0].values[0][0]
        : 0;
      return {
        lastInsertRowid: rowid,
        changes: sqlDb.getRowsModified(),
      };
    },

    exec(sql, params = []) {
      // If no params and has no ? placeholders (or is multi-statement), use raw exec
      if (params.length === 0 && !sql.includes('?')) {
        const raw = sqlDb.exec(sql);
        if (raw.length === 0) return [];
        // Flatten all results — assume single result set if one, merge if multiple
        const allRows = [];
        for (const resultSet of raw) {
          for (const val of resultSet.values) {
            const row = {};
            resultSet.columns.forEach((col, i) => { row[col] = val[i]; });
            allRows.push(row);
          }
        }
        return allRows;
      }
      const stmt = sqlDb.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },

    get(sql, params = []) {
      const rows = this.exec(sql, params);
      return rows.length > 0 ? rows[0] : undefined;
    },

    execRaw(sql) {
      return sqlDb.exec(sql);
    },

    prepare(sql) {
      const stmt = sqlDb.prepare(sql);
      return {
        _stmt: stmt,
        get(...params) {
          stmt.bind(params);
          if (stmt.step()) {
            const obj = stmt.getAsObject();
            stmt.free();
            return obj;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        },
        run(...params) {
          stmt.bind(params);
          stmt.step();
          stmt.free();
          const result = sqlDb.exec('SELECT last_insert_rowid()');
          return {
            lastInsertRowid: result.length > 0 ? result[0].values[0][0] : 0,
            changes: sqlDb.getRowsModified(),
          };
        },
      };
    },

    transaction(fn) {
      sqlDb.run('BEGIN TRANSACTION');
      try {
        fn();
        sqlDb.run('COMMIT');
        saveToDisk();
      } catch (e) {
        sqlDb.run('ROLLBACK');
        throw e;
      }
    },

    save() {
      const data = sqlDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(config.dbPath, buffer);
    },
  };

  // Run PRAGMAs — WAL mode disabled: sql.js runs in-memory with virtual FS;
  // WAL/SHM side files fill the virtual disk and cause "disk I/O error" over time.
  // The auto-save interval already persists to real disk.
  db._db.run('PRAGMA journal_mode = DELETE');
  db._db.run('PRAGMA foreign_keys = ON');

  // Apply migrations
  runMigrations();

  // Start auto-save
  if (!saveInterval) {
    saveInterval = setInterval(saveToDisk, 30000);
  }

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  // Init migration tracking
  db._db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedRows = db.exec('SELECT name FROM _migrations');
  const applied = new Set(appliedRows.map(r => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const migration = require(path.join(migrationsDir, file));
    migration.up(db);
    db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
    console.log(`[migration] Applied: ${file}`);
  }
}

module.exports = { initDatabase, getDb };
