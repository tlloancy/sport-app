import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { MetricType } from '@/lib/metrics';
import { isMetricType } from '@/lib/metrics';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'sport.db');

export type FamilyRow = {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
};

export type DisciplineRow = {
  slug: string;
  label: string;
  family: string;
  metric_type: MetricType;
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

const SEED_FAMILIES: Array<Omit<FamilyRow, never>> = [
  { slug: 'sport', label: 'Sport', emoji: '⚡', sort_order: 1 },
  { slug: 'cuisine', label: 'Cuisine', emoji: '🍳', sort_order: 2 },
  { slug: 'jeux', label: 'Jeux vidéo', emoji: '🎮', sort_order: 3 },
  { slug: 'art', label: 'Art', emoji: '🎨', sort_order: 4 },
  { slug: 'musique', label: 'Musique', emoji: '🎵', sort_order: 5 },
  { slug: 'autre', label: 'Autre', emoji: '✨', sort_order: 6 },
];

const SEED_DISCIPLINES: Array<{
  slug: string;
  label: string;
  family: string;
  metric_type: MetricType;
}> = [{ slug: 'halterophilie', label: 'Haltérophilie', family: 'sport', metric_type: 'weight' }];

const RESERVED_DISCIPLINE_SLUGS = new Set(SEED_FAMILIES.map((f) => f.slug));

let db: Database.Database | null = null;

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS families (
      slug TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS disciplines (
      slug TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      family TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (family) REFERENCES families(slug)
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

    CREATE TABLE IF NOT EXISTS elo_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      winner_uri TEXT NOT NULL,
      loser_uri TEXT NOT NULL,
      anon_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function seedFamilies(database: Database.Database) {
  const row = database.prepare('SELECT COUNT(*) AS count FROM families').get() as { count: number };
  if (row.count > 0) return;

  const insert = database.prepare(
    'INSERT INTO families (slug, label, emoji, sort_order) VALUES (?, ?, ?, ?)'
  );
  for (const family of SEED_FAMILIES) {
    insert.run(family.slug, family.label, family.emoji, family.sort_order);
  }
}

function seedDisciplines(database: Database.Database) {
  const row = database.prepare('SELECT COUNT(*) AS count FROM disciplines').get() as {
    count: number;
  };
  if (row.count > 0) return;

  const insert = database.prepare(
    'INSERT INTO disciplines (slug, label, family, metric_type, active, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  );
  const now = new Date().toISOString();
  for (const discipline of SEED_DISCIPLINES) {
    insert.run(
      discipline.slug,
      discipline.label,
      discipline.family,
      discipline.metric_type,
      now
    );
  }
}

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
    seedFamilies(db);
    seedDisciplines(db);
  }
  return db;
}

export function listFamilies(): FamilyRow[] {
  return getDb()
    .prepare('SELECT slug, label, emoji, sort_order FROM families ORDER BY sort_order, label')
    .all() as FamilyRow[];
}

export function getFamily(slug: string): FamilyRow | undefined {
  return getDb()
    .prepare('SELECT slug, label, emoji, sort_order FROM families WHERE slug = ?')
    .get(slug.toLowerCase()) as FamilyRow | undefined;
}

export function isValidFamily(slug: string): boolean {
  return Boolean(getFamily(slug));
}

export function listActiveDisciplines(family?: string): DisciplineRow[] {
  if (family) {
    return getDb()
      .prepare(
        'SELECT slug, label, family, metric_type, active, created_at FROM disciplines WHERE active = 1 AND family = ? ORDER BY label'
      )
      .all(family.toLowerCase()) as DisciplineRow[];
  }
  return getDb()
    .prepare(
      'SELECT slug, label, family, metric_type, active, created_at FROM disciplines WHERE active = 1 ORDER BY label'
    )
    .all() as DisciplineRow[];
}

export function listAllDisciplines(): DisciplineRow[] {
  return getDb()
    .prepare(
      'SELECT slug, label, family, metric_type, active, created_at FROM disciplines ORDER BY label'
    )
    .all() as DisciplineRow[];
}

export function getDiscipline(slug: string): DisciplineRow | undefined {
  return getDb()
    .prepare(
      'SELECT slug, label, family, metric_type, active, created_at FROM disciplines WHERE slug = ?'
    )
    .get(slug.toLowerCase()) as DisciplineRow | undefined;
}

export function isActiveDiscipline(slug: string): boolean {
  const row = getDiscipline(slug);
  return Boolean(row && row.active === 1);
}

export function getActiveDisciplineSlugs(): Set<string> {
  return new Set(listActiveDisciplines().map((d) => d.slug));
}

export function addDiscipline(
  slug: string,
  label: string,
  family: string,
  metricType: MetricType
): void {
  if (RESERVED_DISCIPLINE_SLUGS.has(slug)) {
    throw new Error('Slug réservé (famille).');
  }
  if (!isValidFamily(family)) {
    throw new Error('Famille inconnue.');
  }
  if (!isMetricType(metricType)) {
    throw new Error('Type de métrique invalide.');
  }
  getDb()
    .prepare(
      'INSERT INTO disciplines (slug, label, family, metric_type, active, created_at) VALUES (?, ?, ?, ?, 1, ?)'
    )
    .run(slug, label, family.toLowerCase(), metricType, new Date().toISOString());
}

export function softDeleteDiscipline(slug: string): boolean {
  const result = getDb()
    .prepare('UPDATE disciplines SET active = 0 WHERE slug = ?')
    .run(slug.toLowerCase());
  return result.changes > 0;
}

export function normalizeMovement(movement: string): string {
  return movement.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** @deprecated use normalizeMovement */
export function normalizeMovementSlug(movement: string): string {
  return normalizeMovement(movement);
}

export function getModeratedOutUris(): Set<string> {
  const rows = getDb()
    .prepare('SELECT uri FROM moderation WHERE hidden = 1 OR deleted = 1')
    .all() as Pick<ModerationRow, 'uri'>[];
  return new Set(rows.map((r) => r.uri));
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

export type EloVoteRow = {
  id: number;
  winner_uri: string;
  loser_uri: string;
  anon_id: string;
  created_at: string;
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

export function upsertEloScore(uri: string, score: number, voteCount: number): void {
  getDb()
    .prepare(
      `INSERT INTO elo_scores (uri, score, vote_count)
       VALUES (?, ?, ?)
       ON CONFLICT(uri) DO UPDATE SET score = ?, vote_count = ?`
    )
    .run(uri, score, voteCount, score, voteCount);
}

export function insertEloVote(
  winnerUri: string,
  loserUri: string,
  anonId: string
): void {
  getDb()
    .prepare(
      'INSERT INTO elo_votes (winner_uri, loser_uri, anon_id, created_at) VALUES (?, ?, ?, ?)'
    )
    .run(winnerUri, loserUri, anonId, new Date().toISOString());
}

export function countVotesSince(anonId: string, sinceIso: string): number {
  const row = getDb()
    .prepare(
      'SELECT COUNT(*) AS count FROM elo_votes WHERE anon_id = ? AND created_at >= ?'
    )
    .get(anonId, sinceIso) as { count: number };
  return row.count;
}

export function insertReport(uri: string, reason: string | null, anonId: string) {
  getDb()
    .prepare('INSERT INTO reports (uri, reason, anon_id, created_at) VALUES (?, ?, ?, ?)')
    .run(uri, reason, anonId, new Date().toISOString());
}
