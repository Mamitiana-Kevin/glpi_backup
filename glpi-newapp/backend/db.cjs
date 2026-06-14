/**
 * db.js — Accès SQLite via sql.js (WebAssembly, zéro compilation native)
 *
 * sql.js maintient la base EN MÉMOIRE et synchronise sur disque à chaque écriture.
 * C'est l'équivalent exact du comportement de Spring Boot + sqlite-jdbc :
 * chaque appel .run() est immédiatement persisté dans glpi_data.db.
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'glpi_data.db');

let _db = null;

async function init() {
  const SQL = await initSqlJs();

  // Charger la base existante ou en créer une nouvelle
  let buffer;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }

  _db = buffer ? new SQL.Database(buffer) : new SQL.Database();

  // On active les foreign keys
  _db.run(`PRAGMA foreign_keys = ON`);

  // Création des tables
  _db.run(`
    CREATE TABLE IF NOT EXISTS kanban_settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT    NOT NULL,
      value      TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      changed_by TEXT    NOT NULL DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS kanban_color_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      status_id  INTEGER NOT NULL,
      old_color  TEXT    NOT NULL,
      new_color  TEXT    NOT NULL,
      changed_at TEXT    NOT NULL DEFAULT (datetime('now')),
      changed_by TEXT    NOT NULL DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS kanban_languages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      language_code TEXT    NOT NULL,
      status_id     INTEGER NOT NULL,
      label         TEXT    NOT NULL,
      UNIQUE (language_code, status_id)
    );

    CREATE TABLE IF NOT EXISTS ticket_status_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL,
      ticket_name TEXT    NOT NULL,
      old_status  INTEGER NOT NULL,
      new_status  INTEGER NOT NULL,
      changed_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_super_cost (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id      INTEGER NOT NULL,
      amount         REAL    NOT NULL,
      reopening_pct  REAL,
      is_active      INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ticket_item (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      item_id   INTEGER NOT NULL,
      itemtype  TEXT    NOT NULL,
      UNIQUE(ticket_id, item_id, itemtype)
    );
  `);

  // Sauvegarder immédiatement si nouvelle base
  _save();

  return wrapper;
}

function _save() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

const wrapper = {
  prepare(sql) {
    return {
      get(...params) {
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },
      all(...params) {
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
      run(...params) {
        _db.run(sql, params);
        _save();
        const lastId = _db.exec('SELECT last_insert_rowid() as id')[0];
        const lastInsertRowid = lastId ? lastId.values[0][0] : null;
        const changes = _db.exec('SELECT changes() as c')[0];
        return {
          lastInsertRowid,
          changes: changes ? changes.values[0][0] : 0,
        };
      },
    };
  },

  exec(sql) {
    const result = _db.exec(sql);
    _save();
    return result;
  },

  transaction(fn) {
    return function(...args) {
      _db.run('BEGIN');
      try {
        const result = fn.apply(this, args);
        _db.run('COMMIT');
        _save();
        return result;
      } catch (e) {
        _db.run('ROLLBACK');
        throw e;
      }
    };
  },
};

module.exports = { init, wrapper };
