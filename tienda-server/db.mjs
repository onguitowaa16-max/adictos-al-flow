import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.STORE_DB || join(here, "data", "store.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    csrf TEXT NOT NULL,
    admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    ip_hash TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_attempts_key ON login_attempts(key, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`);

export const stmts = {
  getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
  allSettings: db.prepare("SELECT key, value FROM settings"),
  insertSettingIfMissing: db.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)"),
  upsertSetting: db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ),
  findAdmin: db.prepare("SELECT id, email, pass_hash FROM admin_users WHERE email = ?"),
  adminCount: db.prepare("SELECT COUNT(*) AS n FROM admin_users"),
  insertAdmin: db.prepare("INSERT INTO admin_users (email, pass_hash, created_at) VALUES (?, ?, ?)"),
  upsertAdmin: db.prepare(
    "INSERT INTO admin_users (email, pass_hash, created_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(email) DO UPDATE SET pass_hash = excluded.pass_hash"
  ),
  insertSession: db.prepare(
    "INSERT INTO sessions (token_hash, csrf, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ),
  findSession: db.prepare(
    "SELECT token_hash, csrf, admin_id, expires_at FROM sessions WHERE token_hash = ?"
  ),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  purgeSessions: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
  addAttempt: db.prepare("INSERT INTO login_attempts (key, created_at) VALUES (?, ?)"),
  countAttempts: db.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND created_at > ?"),
  clearAttempts: db.prepare("DELETE FROM login_attempts WHERE key = ?"),
  pruneAttempts: db.prepare("DELETE FROM login_attempts WHERE created_at <= ?"),
  audit: db.prepare("INSERT INTO audit_log (action, ip_hash, created_at) VALUES (?, ?, ?)"),
};

const DEFAULTS = {
  whatsappNumber: "",
  usdRate: "60",
  eurRate: "65",
  stripText: "PEDIDO MÍNIMO DE 3 PRODUCTOS O MÁS",
  stripEnabled: "true",
  version: "1",
};

export function ensureDefaults() {
  const now = Date.now();
  for (const [key, value] of Object.entries(DEFAULTS)) {
    stmts.insertSettingIfMissing.run(key, value, now);
  }
}

function settingsMap() {
  const map = Object.create(null);
  for (const row of stmts.allSettings.all()) map[row.key] = row.value;
  return map;
}

export function readConfig() {
  const map = settingsMap();
  const usd = Number(map.usdRate);
  const eur = Number(map.eurRate);
  return {
    whatsappNumber: typeof map.whatsappNumber === "string" ? map.whatsappNumber : "",
    usdRate: Number.isFinite(usd) && usd > 0 ? usd : 60,
    eurRate: Number.isFinite(eur) && eur > 0 ? eur : 65,
    stripText: typeof map.stripText === "string" ? map.stripText : "",
    stripEnabled: map.stripEnabled !== "false",
  };
}

export function configVersion() {
  const row = stmts.getSetting.get("version");
  const version = Number(row && row.value);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

export function saveConfig(config) {
  const now = Date.now();
  const current = stmts.getSetting.get("version");
  const previous = Number(current && current.value) || 0;
  const version = Math.max(Math.floor(now / 1000), previous + 1);

  db.exec("BEGIN IMMEDIATE");
  try {
    stmts.upsertSetting.run("whatsappNumber", config.whatsappNumber, now);
    stmts.upsertSetting.run("usdRate", String(config.usdRate), now);
    stmts.upsertSetting.run("eurRate", String(config.eurRate), now);
    stmts.upsertSetting.run("stripText", config.stripText, now);
    stmts.upsertSetting.run("stripEnabled", config.stripEnabled ? "true" : "false", now);
    stmts.upsertSetting.run("version", String(version), now);
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw error;
  }
  return version;
}

export function findAdmin(email) {
  return stmts.findAdmin.get(email);
}

export function adminCount() {
  return Number(stmts.adminCount.get().n);
}

export function createAdmin(email, passHash) {
  return stmts.insertAdmin.run(email, passHash, Date.now());
}

export function upsertAdmin(email, passHash) {
  return stmts.upsertAdmin.run(email, passHash, Date.now());
}

export function createSession(tokenHash, csrf, adminId, expiresAt) {
  stmts.insertSession.run(tokenHash, csrf, adminId, expiresAt, Date.now());
}

export function getSession(tokenHash) {
  return stmts.findSession.get(tokenHash);
}

export function deleteSession(tokenHash) {
  stmts.deleteSession.run(tokenHash);
}

export function purgeSessions() {
  stmts.purgeSessions.run(Date.now());
}

export function countAttempts(key, since) {
  return Number(stmts.countAttempts.get(key, since).n);
}

export function addAttempt(key) {
  stmts.addAttempt.run(key, Date.now());
}

export function clearAttempts(key) {
  stmts.clearAttempts.run(key);
}

export function pruneAttempts(before) {
  stmts.pruneAttempts.run(before);
}

export function audit(action, ipHash) {
  stmts.audit.run(action, ipHash, Date.now());
}

ensureDefaults();
