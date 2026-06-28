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

    CREATE TABLE IF NOT EXISTS elo_scores (
      uri TEXT PRIMARY KEY,
      score REAL NOT NULL DEFAULT 1000,
      vote_count INTEGER NOT NULL DEFAULT 0
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

export function listRecentReports(limit = 50): ReportRow[] {
  return getDb()
    .prepare(
      'SELECT id, uri, reason, anon_id, created_at FROM reports ORDER BY id DESC LIMIT ?'
    )
    .all(limit) as ReportRow[];
}

export function getModerationMap(): Map<string, Pick<ModerationRow, 'hidden' | 'deleted'>> {
  const rows = getDb()
    .prepare('SELECT uri, hidden, deleted FROM moderation')
    .all() as Pick<ModerationRow, 'uri' | 'hidden' | 'deleted'>[];
  return new Map(rows.map((r) => [r.uri, { hidden: r.hidden, deleted: r.deleted }]));
}

function upsertModeration(uri: string, hidden: number, deleted: number) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO moderation (uri, hidden, deleted, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(uri) DO UPDATE SET hidden = ?, deleted = ?`
    )
    .run(uri, hidden, deleted, now, hidden, deleted);
}

export function hidePerformance(uri: string) {
  const existing = getModerationMap().get(uri);
  upsertModeration(uri, 1, existing?.deleted ?? 0);
}

export function deletePerformance(uri: string) {
  const existing = getModerationMap().get(uri);
  upsertModeration(uri, existing?.hidden ?? 0, 1);
}

export function countReportsSince(anonId: string, sinceIso: string): number {
  const row = getDb()
    .prepare(
      'SELECT COUNT(*) AS count FROM reports WHERE anon_id = ? AND created_at >= ?'
    )
    .get(anonId, sinceIso) as { count: number };
  return row.count;
}

export type EloScoreRow = {
  uri: string;
  score: number;
  vote_count: number;
};

export function getEloScore(uri: string): EloScoreRow {
  const row = getDb()
    .prepare('SELECT uri, score, vote_count FROM elo_scores WHERE uri = ?')
    .get(uri) as EloScoreRow | undefined;
  return row ?? { uri, score: 1000, vote_count: 0 };
}

export function getEloScoresForUris(uris: string[]): Map<string, EloScoreRow> {
  const map = new Map<string, EloScoreRow>();
  if (uris.length === 0) return map;

  const placeholders = uris.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(`SELECT uri, score, vote_count FROM elo_scores WHERE uri IN (${placeholders})`)
    .all(...uris) as EloScoreRow[];

  for (const uri of uris) {
    map.set(uri, { uri, score: 1000, vote_count: 0 });
  }
  for (const row of rows) {
    map.set(row.uri, row);
  }
  return map;
}

export function insertReport(uri: string, reason: string | null, anonId: string) {
  getDb()
    .prepare('INSERT INTO reports (uri, reason, anon_id, created_at) VALUES (?, ?, ?, ?)')
    .run(uri, reason, anonId, new Date().toISOString());
}
