/**
 * Database module supporting both:
 * - SQLite (local development via better-sqlite3)
 * - Turso/LibSQL (production via @libsql/client)
 *
 * Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for production.
 * Falls back to local SQLite if not set.
 */

import Database from "better-sqlite3";
import { createClient, Client } from "@libsql/client";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "events.db");

// Database mode detection
const useTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let sqliteDb: Database.Database | null = null;
let tursoClient: Client | null = null;

// Initialize schema SQL
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title_ja TEXT NOT NULL,
    title_en TEXT,
    description_ja TEXT,
    description_en TEXT,
    date_start TEXT NOT NULL,
    date_end TEXT,
    venue_name TEXT NOT NULL,
    venue_address TEXT,
    area TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT,
    price_min INTEGER,
    price_max INTEGER,
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`;

const INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_events_date_start ON events(date_start)",
  "CREATE INDEX IF NOT EXISTS idx_events_area ON events(area)",
  "CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)",
  "CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_name)",
];

// SQLite initialization
function initSqlite(): Database.Database {
  if (sqliteDb) return sqliteDb;

  const fs = require("fs");
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqliteDb = new Database(DB_PATH);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.exec(SCHEMA_SQL);
  INDEXES_SQL.forEach((sql) => sqliteDb!.exec(sql));

  return sqliteDb;
}

// Turso initialization
async function initTurso(): Promise<Client> {
  if (tursoClient) return tursoClient;

  tursoClient = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  // Initialize schema
  await tursoClient.execute(SCHEMA_SQL);
  for (const sql of INDEXES_SQL) {
    await tursoClient.execute(sql);
  }

  return tursoClient;
}

// Types
export interface Event {
  id: string;
  title_ja: string;
  title_en: string | null;
  description_ja: string | null;
  description_en: string | null;
  date_start: string;
  date_end: string | null;
  venue_name: string;
  venue_address: string | null;
  area: string;
  category: string;
  tags: string[] | null;
  price_min: number | null;
  price_max: number | null;
  source_url: string;
  source_name: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventFilters {
  startDate?: string;
  endDate?: string;
  area?: string;
  category?: string;
  search?: string;
  source?: string;
  page?: number;
  limit?: number;
}

// Helper to parse row to Event
function parseEvent(row: Record<string, unknown>): Event {
  return {
    ...(row as unknown as Omit<Event, "tags">),
    tags: row.tags ? JSON.parse(row.tags as string) : null,
  };
}

// ============ SQLite implementations ============

function getEventsSqlite(filters: EventFilters): { events: Event[]; total: number } {
  const db = initSqlite();
  const { startDate, endDate, area, category, search, source, page = 1, limit = 20 } = filters;

  const conditions: string[] = [];
  const params: Record<string, string | number> = {};

  if (startDate) {
    conditions.push("date_start >= @startDate");
    params.startDate = startDate;
  }
  if (endDate) {
    conditions.push("(date_end <= @endDate OR (date_end IS NULL AND date_start <= @endDate))");
    params.endDate = endDate;
  }
  if (area) {
    conditions.push("LOWER(area) = LOWER(@area)");
    params.area = area;
  }
  if (category) {
    conditions.push("LOWER(category) = LOWER(@category)");
    params.category = category;
  }
  if (source) {
    conditions.push("LOWER(source_name) = LOWER(@source)");
    params.source = source;
  }
  if (search) {
    conditions.push(
      "(title_ja LIKE @search OR title_en LIKE @search OR description_ja LIKE @search OR description_en LIKE @search)"
    );
    params.search = `%${search}%`;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM events ${whereClause}`);
  const { count: total } = countStmt.get(params) as { count: number };

  const stmt = db.prepare(`
    SELECT * FROM events ${whereClause}
    ORDER BY date_start ASC
    LIMIT @limit OFFSET @offset
  `);
  const rows = stmt.all({ ...params, limit, offset }) as Record<string, unknown>[];

  return { events: rows.map(parseEvent), total };
}

function getEventByIdSqlite(id: string): Event | null {
  const db = initSqlite();
  const stmt = db.prepare("SELECT * FROM events WHERE id = ?");
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? parseEvent(row) : null;
}

function upsertEventSqlite(event: Omit<Event, "created_at" | "updated_at">): void {
  const db = initSqlite();
  const stmt = db.prepare(`
    INSERT INTO events (
      id, title_ja, title_en, description_ja, description_en,
      date_start, date_end, venue_name, venue_address, area,
      category, tags, price_min, price_max, source_url, source_name, image_url
    ) VALUES (
      @id, @title_ja, @title_en, @description_ja, @description_en,
      @date_start, @date_end, @venue_name, @venue_address, @area,
      @category, @tags, @price_min, @price_max, @source_url, @source_name, @image_url
    )
    ON CONFLICT(id) DO UPDATE SET
      title_ja = @title_ja, title_en = @title_en,
      description_ja = @description_ja, description_en = @description_en,
      date_start = @date_start, date_end = @date_end,
      venue_name = @venue_name, venue_address = @venue_address,
      area = @area, category = @category, tags = @tags,
      price_min = @price_min, price_max = @price_max,
      source_url = @source_url, source_name = @source_name,
      image_url = @image_url, updated_at = datetime('now')
  `);
  stmt.run({ ...event, tags: event.tags ? JSON.stringify(event.tags) : null });
}

function getCategoriesSqlite(): string[] {
  const db = initSqlite();
  const rows = db.prepare("SELECT DISTINCT category FROM events ORDER BY category").all() as { category: string }[];
  return rows.map((r) => r.category);
}

function getAreasSqlite(): string[] {
  const db = initSqlite();
  const rows = db.prepare("SELECT DISTINCT area FROM events ORDER BY area").all() as { area: string }[];
  return rows.map((r) => r.area);
}

function getSourcesSqlite(): string[] {
  const db = initSqlite();
  const rows = db.prepare("SELECT DISTINCT source_name FROM events ORDER BY source_name").all() as { source_name: string }[];
  return rows.map((r) => r.source_name);
}

// ============ Turso implementations ============

async function getEventsTurso(filters: EventFilters): Promise<{ events: Event[]; total: number }> {
  const client = await initTurso();
  const { startDate, endDate, area, category, search, source, page = 1, limit = 20 } = filters;

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (startDate) {
    conditions.push("date_start >= ?");
    args.push(startDate);
  }
  if (endDate) {
    conditions.push("(date_end <= ? OR (date_end IS NULL AND date_start <= ?))");
    args.push(endDate, endDate);
  }
  if (area) {
    conditions.push("LOWER(area) = LOWER(?)");
    args.push(area);
  }
  if (category) {
    conditions.push("LOWER(category) = LOWER(?)");
    args.push(category);
  }
  if (source) {
    conditions.push("LOWER(source_name) = LOWER(?)");
    args.push(source);
  }
  if (search) {
    conditions.push(
      "(title_ja LIKE ? OR title_en LIKE ? OR description_ja LIKE ? OR description_en LIKE ?)"
    );
    const searchPattern = `%${search}%`;
    args.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const countResult = await client.execute({
    sql: `SELECT COUNT(*) as count FROM events ${whereClause}`,
    args,
  });
  const total = Number(countResult.rows[0]?.count ?? 0);

  const result = await client.execute({
    sql: `SELECT * FROM events ${whereClause} ORDER BY date_start ASC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  const events = result.rows.map((row) => parseEvent(row as unknown as Record<string, unknown>));
  return { events, total };
}

async function getEventByIdTurso(id: string): Promise<Event | null> {
  const client = await initTurso();
  const result = await client.execute({
    sql: "SELECT * FROM events WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  return row ? parseEvent(row as unknown as Record<string, unknown>) : null;
}

async function upsertEventTurso(event: Omit<Event, "created_at" | "updated_at">): Promise<void> {
  const client = await initTurso();
  await client.execute({
    sql: `
      INSERT INTO events (
        id, title_ja, title_en, description_ja, description_en,
        date_start, date_end, venue_name, venue_address, area,
        category, tags, price_min, price_max, source_url, source_name, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title_ja = excluded.title_ja, title_en = excluded.title_en,
        description_ja = excluded.description_ja, description_en = excluded.description_en,
        date_start = excluded.date_start, date_end = excluded.date_end,
        venue_name = excluded.venue_name, venue_address = excluded.venue_address,
        area = excluded.area, category = excluded.category, tags = excluded.tags,
        price_min = excluded.price_min, price_max = excluded.price_max,
        source_url = excluded.source_url, source_name = excluded.source_name,
        image_url = excluded.image_url, updated_at = datetime('now')
    `,
    args: [
      event.id, event.title_ja, event.title_en, event.description_ja, event.description_en,
      event.date_start, event.date_end, event.venue_name, event.venue_address, event.area,
      event.category, event.tags ? JSON.stringify(event.tags) : null,
      event.price_min, event.price_max, event.source_url, event.source_name, event.image_url,
    ],
  });
}

async function getCategoriesTurso(): Promise<string[]> {
  const client = await initTurso();
  const result = await client.execute("SELECT DISTINCT category FROM events ORDER BY category");
  return result.rows.map((r) => r.category as string);
}

async function getAreasTurso(): Promise<string[]> {
  const client = await initTurso();
  const result = await client.execute("SELECT DISTINCT area FROM events ORDER BY area");
  return result.rows.map((r) => r.area as string);
}

async function getSourcesTurso(): Promise<string[]> {
  const client = await initTurso();
  const result = await client.execute("SELECT DISTINCT source_name FROM events ORDER BY source_name");
  return result.rows.map((r) => r.source_name as string);
}

// ============ Exported functions (sync for SQLite, async wrappers) ============

// For backward compatibility, these are synchronous when using SQLite
// They return the result directly or throw if async is needed

export function getEvents(filters: EventFilters = {}): { events: Event[]; total: number } {
  if (useTurso) {
    throw new Error("Use getEventsAsync() in production with Turso");
  }
  return getEventsSqlite(filters);
}

export function getEventById(id: string): Event | null {
  if (useTurso) {
    throw new Error("Use getEventByIdAsync() in production with Turso");
  }
  return getEventByIdSqlite(id);
}

export function upsertEvent(event: Omit<Event, "created_at" | "updated_at">): void {
  if (useTurso) {
    throw new Error("Use upsertEventAsync() in production with Turso");
  }
  upsertEventSqlite(event);
}

export function getCategories(): string[] {
  if (useTurso) {
    throw new Error("Use getCategoriesAsync() in production with Turso");
  }
  return getCategoriesSqlite();
}

export function getAreas(): string[] {
  if (useTurso) {
    throw new Error("Use getAreasAsync() in production with Turso");
  }
  return getAreasSqlite();
}

export function getSources(): string[] {
  if (useTurso) {
    throw new Error("Use getSourcesAsync() in production with Turso");
  }
  return getSourcesSqlite();
}

// Async versions that work with both SQLite and Turso
export async function getEventsAsync(filters: EventFilters = {}): Promise<{ events: Event[]; total: number }> {
  if (useTurso) {
    return getEventsTurso(filters);
  }
  return getEventsSqlite(filters);
}

export async function getEventByIdAsync(id: string): Promise<Event | null> {
  if (useTurso) {
    return getEventByIdTurso(id);
  }
  return getEventByIdSqlite(id);
}

export async function upsertEventAsync(event: Omit<Event, "created_at" | "updated_at">): Promise<void> {
  if (useTurso) {
    return upsertEventTurso(event);
  }
  upsertEventSqlite(event);
}

export async function getCategoriesAsync(): Promise<string[]> {
  if (useTurso) {
    return getCategoriesTurso();
  }
  return getCategoriesSqlite();
}

export async function getAreasAsync(): Promise<string[]> {
  if (useTurso) {
    return getAreasTurso();
  }
  return getAreasSqlite();
}

export async function getSourcesAsync(): Promise<string[]> {
  if (useTurso) {
    return getSourcesTurso();
  }
  return getSourcesSqlite();
}

// Export the database mode for debugging
export function getDatabaseMode(): "sqlite" | "turso" {
  return useTurso ? "turso" : "sqlite";
}

// For local SQLite access (scripts, etc.)
export function getDb(): Database.Database {
  return initSqlite();
}
