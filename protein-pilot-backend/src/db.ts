import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
export type DB = Database.Database;
export function database(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const file = path.join(dir, "protein-pilot.sqlite");
  const db = new Database(file);
  chmodSync(file, 0o600);
  if (Number(db.pragma("user_version", { simple: true })) > 1) {
    db.close();
    throw new Error("Database schema is newer than this server.");
  }
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("secure_delete = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, profile TEXT NOT NULL, reminders TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_links(hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, verified_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS target_guidance(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(user_id,day));
    CREATE TABLE IF NOT EXISTS targets(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, protein REAL NOT NULL, PRIMARY KEY(user_id,day));
    CREATE TABLE IF NOT EXISTS meals(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, day TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS meals_user_day ON meals(user_id,day,deleted_at);
    CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, meal_id TEXT REFERENCES meals(id), created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS operations(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, scope TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(user_id,key));
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, state TEXT NOT NULL, image BLOB, mime TEXT, result TEXT, error TEXT, draft_id TEXT REFERENCES drafts(id), metadata TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(state,created_at);
    CREATE TABLE IF NOT EXISTS ai_usage(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(user_id,day));
    CREATE TABLE IF NOT EXISTS favorites(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, week TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, UNIQUE(user_id,week));
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS support(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS exports(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS meal_photos(draft_id TEXT PRIMARY KEY REFERENCES drafts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, meal_id TEXT UNIQUE REFERENCES meals(id) ON DELETE CASCADE, image BLOB NOT NULL, created_at INTEGER NOT NULL);
    PRAGMA user_version=1;
  `);
  return db;
}
export function one(db: DB, sql: string, ...params: unknown[]): any {
  return db.prepare(sql).get(...params);
}
export function all(db: DB, sql: string, ...params: unknown[]): any[] {
  return db.prepare(sql).all(...params);
}
export function run(db: DB, sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...params);
}
