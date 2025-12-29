/**
 * Database module supporting both:
 * - SQLite (local development via better-sqlite3)
 * - Supabase (production via @supabase/supabase-js)
 *
 * Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for production.
 * Falls back to local SQLite if not set.
 */

import Database from "better-sqlite3";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "events.db");

// Database mode detection
const useSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let sqliteDb: Database.Database | null = null;
let supabaseClient: SupabaseClient | null = null;

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

  // Create table
  sqliteDb.exec(`
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
  `);

  // Create indexes
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_events_date_start ON events(date_start)");
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_events_area ON events(area)");
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)");
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_name)");

  return sqliteDb;
}

// Supabase initialization
function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return supabaseClient;
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

// Helper to parse SQLite row to Event
function parseEventFromSqlite(row: Record<string, unknown>): Event {
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

  return { events: rows.map(parseEventFromSqlite), total };
}

function getEventByIdSqlite(id: string): Event | null {
  const db = initSqlite();
  const stmt = db.prepare("SELECT * FROM events WHERE id = ?");
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? parseEventFromSqlite(row) : null;
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

// ============ Supabase implementations ============

async function getEventsSupabase(filters: EventFilters): Promise<{ events: Event[]; total: number }> {
  const supabase = getSupabase();
  const { startDate, endDate, area, category, search, source, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase.from("events").select("*", { count: "exact" });

  if (startDate) {
    query = query.gte("date_start", startDate);
  }
  if (endDate) {
    query = query.or(`date_end.lte.${endDate},and(date_end.is.null,date_start.lte.${endDate})`);
  }
  if (area) {
    query = query.ilike("area", area);
  }
  if (category) {
    query = query.ilike("category", category);
  }
  if (source) {
    query = query.ilike("source_name", source);
  }
  if (search) {
    query = query.or(
      `title_ja.ilike.%${search}%,title_en.ilike.%${search}%,description_ja.ilike.%${search}%,description_en.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query
    .order("date_start", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Supabase error:", error);
    throw error;
  }

  return {
    events: (data || []) as Event[],
    total: count || 0,
  };
}

async function getEventByIdSupabase(id: string): Promise<Event | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data as Event;
}

async function upsertEventSupabase(event: Omit<Event, "created_at" | "updated_at">): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("events")
    .upsert({
      ...event,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Supabase upsert error:", error);
    throw error;
  }
}

async function getCategoriesSupabase(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("category")
    .order("category");

  if (error) throw error;

  // Get unique categories
  const categories = [...new Set((data || []).map((r) => r.category))];
  return categories;
}

async function getAreasSupabase(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("area")
    .order("area");

  if (error) throw error;

  const areas = [...new Set((data || []).map((r) => r.area))];
  return areas;
}

async function getSourcesSupabase(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("source_name")
    .order("source_name");

  if (error) throw error;

  const sources = [...new Set((data || []).map((r) => r.source_name))];
  return sources;
}

// ============ Exported functions ============

// Sync versions (SQLite only, for scripts)
export function getEvents(filters: EventFilters = {}): { events: Event[]; total: number } {
  if (useSupabase) {
    throw new Error("Use getEventsAsync() in production with Supabase");
  }
  return getEventsSqlite(filters);
}

export function getEventById(id: string): Event | null {
  if (useSupabase) {
    throw new Error("Use getEventByIdAsync() in production with Supabase");
  }
  return getEventByIdSqlite(id);
}

export function upsertEvent(event: Omit<Event, "created_at" | "updated_at">): void {
  if (useSupabase) {
    throw new Error("Use upsertEventAsync() in production with Supabase");
  }
  upsertEventSqlite(event);
}

export function getCategories(): string[] {
  if (useSupabase) {
    throw new Error("Use getCategoriesAsync() in production with Supabase");
  }
  return getCategoriesSqlite();
}

export function getAreas(): string[] {
  if (useSupabase) {
    throw new Error("Use getAreasAsync() in production with Supabase");
  }
  return getAreasSqlite();
}

export function getSources(): string[] {
  if (useSupabase) {
    throw new Error("Use getSourcesAsync() in production with Supabase");
  }
  return getSourcesSqlite();
}

// Async versions (work with both SQLite and Supabase)
export async function getEventsAsync(filters: EventFilters = {}): Promise<{ events: Event[]; total: number }> {
  if (useSupabase) {
    return getEventsSupabase(filters);
  }
  return getEventsSqlite(filters);
}

export async function getEventByIdAsync(id: string): Promise<Event | null> {
  if (useSupabase) {
    return getEventByIdSupabase(id);
  }
  return getEventByIdSqlite(id);
}

export async function upsertEventAsync(event: Omit<Event, "created_at" | "updated_at">): Promise<void> {
  if (useSupabase) {
    return upsertEventSupabase(event);
  }
  upsertEventSqlite(event);
}

export async function getCategoriesAsync(): Promise<string[]> {
  if (useSupabase) {
    return getCategoriesSupabase();
  }
  return getCategoriesSqlite();
}

export async function getAreasAsync(): Promise<string[]> {
  if (useSupabase) {
    return getAreasSupabase();
  }
  return getAreasSqlite();
}

export async function getSourcesAsync(): Promise<string[]> {
  if (useSupabase) {
    return getSourcesSupabase();
  }
  return getSourcesSqlite();
}

// Utility exports
export function getDatabaseMode(): "sqlite" | "supabase" {
  return useSupabase ? "supabase" : "sqlite";
}

export function getDb(): Database.Database {
  return initSqlite();
}
