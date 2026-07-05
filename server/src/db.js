import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_VALUATIONS, DEFAULT_TRANSFER_PARTNERS } from './seed-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'points.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS valuation_config (
  currency      TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  baseline_cpp  REAL NOT NULL,
  cashback_cpp  REAL NOT NULL,
  portal_cpp    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS point_balances (
  currency      TEXT PRIMARY KEY REFERENCES valuation_config(currency),
  balance       INTEGER NOT NULL DEFAULT 0,
  last_updated  TEXT
);

CREATE TABLE IF NOT EXISTS transfer_partners (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  currency           TEXT NOT NULL REFERENCES valuation_config(currency),
  partner_name       TEXT NOT NULL,
  partner_type       TEXT NOT NULL DEFAULT 'airline',
  ratio_from         REAL NOT NULL DEFAULT 1,
  ratio_to           REAL NOT NULL DEFAULT 1,
  bonus_pct          REAL NOT NULL DEFAULT 0,
  transfer_increment INTEGER NOT NULL DEFAULT 1000,
  UNIQUE (currency, partner_name)
);

CREATE TABLE IF NOT EXISTS trips (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  origin      TEXT,
  destination TEXT,
  start_date  TEXT,
  end_date    TEXT,
  trip_type   TEXT NOT NULL DEFAULT 'flight',
  cabin       TEXT NOT NULL DEFAULT 'economy',
  travelers   INTEGER NOT NULL DEFAULT 1,
  cash_price  REAL,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS award_quotes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  partner_id      INTEGER NOT NULL REFERENCES transfer_partners(id) ON DELETE CASCADE,
  points_required INTEGER NOT NULL,
  taxes_fees      REAL NOT NULL DEFAULT 0,
  note            TEXT
);

CREATE TABLE IF NOT EXISTS redemption_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  redeemed_at  TEXT NOT NULL DEFAULT (date('now')),
  currency     TEXT NOT NULL,
  points_used  INTEGER NOT NULL,
  cash_value   REAL NOT NULL,
  cpp          REAL NOT NULL,
  description  TEXT,
  trip_id      INTEGER REFERENCES trips(id) ON DELETE SET NULL
);
`;

export function createDb(dbPath = DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

function seed(db) {
  const insertValuation = db.prepare(`
    INSERT OR IGNORE INTO valuation_config (currency, display_name, baseline_cpp, cashback_cpp, portal_cpp)
    VALUES (@currency, @displayName, @baselineCpp, @cashbackCpp, @portalCpp)
  `);
  const insertBalance = db.prepare(`
    INSERT OR IGNORE INTO point_balances (currency, balance, last_updated) VALUES (?, 0, NULL)
  `);
  const insertPartner = db.prepare(`
    INSERT OR IGNORE INTO transfer_partners (currency, partner_name, partner_type, ratio_from, ratio_to)
    VALUES (@currency, @partnerName, @partnerType, @ratioFrom, @ratioTo)
  `);
  db.transaction(() => {
    for (const v of DEFAULT_VALUATIONS) {
      insertValuation.run(v);
      insertBalance.run(v.currency);
    }
    for (const p of DEFAULT_TRANSFER_PARTNERS) insertPartner.run(p);
  })();
}
