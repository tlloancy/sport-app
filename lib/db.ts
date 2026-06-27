import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'sport.db');

export type CategoryRow = {
  slug: string;
  label: string;
  active: number;
  created_at: string;
};

export type ModerationRow = {
  uri: string;
  hidden: number;
  deleted: number;
  created_at: string;
};

export type ReportRow = {
  id: number;
  uri: string;
  reason: string | null;
  anon_id: string | null;
  created_at: string;
};

let db: Database.Database | null = null;

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      slug TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS moderation (
      uri TEXT PRIMARY KEY,
      hidden INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uri TEXT NOT NULL,
      reason TEXT,
      anon_id TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function seedCategories(database: Database.Database) {
  const row = database.prepare('SELECT COUNT(*) AS count FROM categories').get() as {
    count: number;
  };
  if (row.count === 0) {
    database
      .prepare(
        'INSERT INTO categories (slug, label, active, created_at) VALUES (?, ?, 1, ?)'
      )
      .run('snatch', 'Snatch', new Date().toISOString());
  }
}

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
    seedCategories(db);
  }
  return db;
}

export function listActiveCategories(): CategoryRow[] {
  return getDb()
    .prepare('SELECT slug, label, active, created_at FROM categories WHERE active = 1 ORDER BY label')
    .all() as CategoryRow[];
}

export function listAllCategories(): CategoryRow[] {
  return getDb()
    .prepare('SELECT slug, label, active, created_at FROM categories ORDER BY label')
    .all() as CategoryRow[];
}

export function isActiveCategory(slug: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM categories WHERE slug = ? AND active = 1')
    .get(slug.toLowerCase());
  return Boolean(row);
}

export function getActiveCategorySlugs(): Set<string> {
  return new Set(listActiveCategories().map((c) => c.slug));
}

export function addCategory(slug: string, label: string): void {
  getDb()
    .prepare(
      'INSERT INTO categories (slug, label, active, created_at) VALUES (?, ?, 1, ?)'
    )
    .run(slug, label, new Date().toISOString());
}

export function softDeleteCategory(slug: string): boolean {
  const result = getDb()
    .prepare('UPDATE categories SET active = 0 WHERE slug = ?')
    .run(slug.toLowerCase());
  return result.changes > 0;
}

export function getModeratedOutUris(): Set<string> {
  const rows = getDb()
    .prepare('SELECT uri FROM moderation WHERE hidden = 1 OR deleted = 1')
    .all() as Pick<ModerationRow, 'uri'>[];
  return new Set(rows.map((r) => r.uri));
}

export function normalizeMovementSlug(movement: string): string {
  return movement.trim().toLowerCase();
}
