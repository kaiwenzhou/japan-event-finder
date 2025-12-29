import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "events.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require("fs");
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
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
    );

    CREATE INDEX IF NOT EXISTS idx_events_date_start ON events(date_start);
    CREATE INDEX IF NOT EXISTS idx_events_area ON events(area);
    CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_name);
  `);
}

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

export function getEvents(filters: EventFilters = {}): { events: Event[]; total: number } {
  const db = getDb();
  const {
    startDate,
    endDate,
    area,
    category,
    search,
    source,
    page = 1,
    limit = 20,
  } = filters;

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

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM events ${whereClause}`);
  const { count: total } = countStmt.get(params) as { count: number };

  // Get paginated results
  const offset = (page - 1) * limit;
  const stmt = db.prepare(`
    SELECT * FROM events
    ${whereClause}
    ORDER BY date_start ASC
    LIMIT @limit OFFSET @offset
  `);

  const rows = stmt.all({ ...params, limit, offset }) as Array<Omit<Event, 'tags'> & { tags: string | null }>;

  const events = rows.map((row) => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : null,
  }));

  return { events, total };
}

export function getEventById(id: string): Event | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM events WHERE id = ?");
  const row = stmt.get(id) as (Omit<Event, 'tags'> & { tags: string | null }) | undefined;

  if (!row) return null;

  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : null,
  };
}

export function upsertEvent(event: Omit<Event, "created_at" | "updated_at">): void {
  const db = getDb();
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
      title_ja = @title_ja,
      title_en = @title_en,
      description_ja = @description_ja,
      description_en = @description_en,
      date_start = @date_start,
      date_end = @date_end,
      venue_name = @venue_name,
      venue_address = @venue_address,
      area = @area,
      category = @category,
      tags = @tags,
      price_min = @price_min,
      price_max = @price_max,
      source_url = @source_url,
      source_name = @source_name,
      image_url = @image_url,
      updated_at = datetime('now')
  `);

  stmt.run({
    ...event,
    tags: event.tags ? JSON.stringify(event.tags) : null,
  });
}

export function getCategories(): string[] {
  const db = getDb();
  const stmt = db.prepare("SELECT DISTINCT category FROM events ORDER BY category");
  const rows = stmt.all() as { category: string }[];
  return rows.map((r) => r.category);
}

export function getAreas(): string[] {
  const db = getDb();
  const stmt = db.prepare("SELECT DISTINCT area FROM events ORDER BY area");
  const rows = stmt.all() as { area: string }[];
  return rows.map((r) => r.area);
}

export function getSources(): string[] {
  const db = getDb();
  const stmt = db.prepare("SELECT DISTINCT source_name FROM events ORDER BY source_name");
  const rows = stmt.all() as { source_name: string }[];
  return rows.map((r) => r.source_name);
}
