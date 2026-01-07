# Japan Event Finder - Project Plan

## Overview
A web app to aggregate events happening in Japan (concerts, theatre, anime collabs, etc.), allowing search by date and location, with links to purchase tickets on original sites.

## User Requirements
- [x] Aggregate events from multiple Japanese sources
- [x] Search/filter by date range and location (e.g., Tokyo, Osaka)
- [x] Link back to original ticket sites for purchase
- [x] Japanese text preserved with English translation option
- [x] Background job to populate events (not on-demand scraping)
- [x] Deployable to Vercel

---

## Tech Stack (Implemented)

| Layer | Technology | Status |
|-------|------------|--------|
| Framework | Next.js 16 + TypeScript | ✅ Done |
| Database | SQLite (better-sqlite3) | ✅ Done |
| Frontend | React + Tailwind CSS | ✅ Done |
| Scrapers | TypeScript + Cheerio | ✅ Done |
| Translation | DeepL / Google Translate API | ✅ Done |
| Deployment | Vercel-ready | ✅ Ready |

---

## Event Sources

### Implemented Scrapers ✅
| Source | Key | Category | Status |
|--------|-----|----------|--------|
| Tokyo Cheapo | `tokyo-cheapo` | Budget events | ✅ |
| Japan Travel | `japan-travel` | Tourist events | ✅ |
| Ticket Pia | `ticket-pia` | All tickets (music, stage, anime) | ✅ |
| Kabuki-bito | `kabuki-bito` | Kabuki | ✅ |
| Tokyo Art Beat | `tokyo-art-beat` | Art/Exhibitions | ✅ |

### Future Sources (Not Yet Implemented)
| Source | URL | Category |
|--------|-----|----------|
| Shochiku | https://www.shochiku.co.jp/ | Kabuki/Theatre |
| NHK Symphony | https://www.nhkso.or.jp/ | Orchestra |
| Billboard Live | https://www.billboard-live.com/ | Live music |
| Parco | https://parco.jp/ | Anime collabs |
| Animate | https://www.animate.co.jp/ | Anime events |

---

## Data Model

```typescript
interface Event {
  id: string;                    // Unique identifier
  title_ja: string;              // Original Japanese title
  title_en: string | null;       // Translated English title
  description_ja: string | null;
  description_en: string | null;
  date_start: string;            // ISO date
  date_end: string | null;
  venue_name: string;
  venue_address: string | null;
  area: string;                  // Tokyo, Osaka, Kyoto, etc.
  category: string;              // kabuki, orchestra, anime, musical, etc.
  tags: string[];
  price_min: number | null;      // In JPY
  price_max: number | null;
  source_url: string;            // Original ticket/info page
  source_name: string;           // e.g., "Ticket Pia"
  image_url: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│  - Event grid with cards                                 │
│  - Search + filters (date, area, category)               │
│  - JP/EN language toggle                                 │
│  - Click → original ticket site                          │
└─────────────────────────┬───────────────────────────────┘
                          │ API calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   API ROUTES                             │
│  GET /api/events       - List & filter events            │
│  GET /api/events/:id   - Single event                    │
│  GET /api/areas        - Available areas                 │
│  GET /api/categories   - Available categories            │
│  POST /api/scrape      - Trigger scrapers                │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   DATABASE (SQLite)                      │
│  data/events.db                                          │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ Populate
┌─────────────────────────┴───────────────────────────────┐
│                   SCRAPERS                               │
│  npm run scrape         - Run all scrapers               │
│  npm run scrape <name>  - Run specific scraper           │
│  POST /api/scrape       - HTTP trigger                   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Set up Next.js project with TypeScript
- [x] Set up database schema (SQLite)
- [x] Create API routes for events
- [x] Build UI with event list and filters
- [x] JP/EN language toggle

### Phase 2: Scrapers ✅ COMPLETE
- [x] Base scraper infrastructure
- [x] Tokyo Cheapo scraper
- [x] Japan Travel scraper
- [x] Ticket Pia scraper
- [x] Kabuki-bito scraper
- [x] Tokyo Art Beat scraper
- [x] Translation support (DeepL/Google)
- [x] CLI + API scrape triggers

### Phase 3: Expand Sources (TODO)
- [ ] NHK Symphony scraper
- [ ] Billboard Live scraper
- [ ] Parco anime collab scraper
- [ ] Deduplication logic
- [ ] Scheduled Vercel Cron jobs

### Phase 4: Polish & Deploy (TODO)
- [ ] Deploy to Vercel
- [ ] Set up Vercel Postgres for production
- [ ] Configure Vercel Cron for scheduled scraping
- [ ] Add error handling and monitoring
- [ ] Environment variable management

### Phase 5: Enhancements (Future)
- [ ] User favorites/bookmarks
- [ ] Email notifications for new events
- [ ] Calendar export (iCal)
- [ ] Mobile-friendly PWA

---

## API Endpoints

```
GET  /api/events
     ?start_date=2024-01-01
     &end_date=2024-01-31
     &area=tokyo
     &category=kabuki
     &search=keyword
     &page=1
     &limit=20

GET  /api/events/:id

GET  /api/categories
GET  /api/areas
GET  /api/sources

GET  /api/scrape          # List available scrapers
POST /api/scrape          # Run all scrapers
POST /api/scrape?source=tokyo-cheapo  # Run specific scraper
```

---

## CLI Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server

# Database
npm run seed             # Seed sample events

# Scrapers
npm run scrape           # Run all scrapers
npm run scrape list      # List available scrapers
npm run scrape <name>    # Run specific scraper
```

---

## Environment Variables

```bash
# Optional: Translation APIs
DEEPL_API_KEY=           # DeepL API key for translations
GOOGLE_TRANSLATE_API_KEY= # Google Translate API key

# Optional: Scrape API protection
SCRAPE_API_KEY=          # Bearer token for /api/scrape endpoint
```

---

## Notes & Considerations

### Scraping
- All scrapers use respectful delays between requests
- User-Agent headers mimic real browsers
- Scrapers are designed to handle missing/malformed data gracefully
- Each scraper generates consistent IDs for deduplication

### Translation
- DeepL is preferred (better Japanese translation quality)
- Falls back to Google Translate if available
- Basic term replacement as ultimate fallback
- Translations are cached in memory

### Legal
- Only scrapes publicly available event listings
- Links back to original sources for ticket purchases
- For personal use / aggregation

---

## File Structure

```
japan-event-finder/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── events/
│   │   │   ├── areas/
│   │   │   ├── categories/
│   │   │   ├── sources/
│   │   │   └── scrape/
│   │   ├── page.tsx        # Main UI
│   │   └── layout.tsx
│   ├── components/
│   │   ├── EventCard.tsx
│   │   ├── EventFilters.tsx
│   │   └── LanguageToggle.tsx
│   ├── lib/
│   │   ├── db.ts           # Database operations
│   │   └── translate.ts    # Translation utilities
│   └── scrapers/
│       ├── base.ts         # Base scraper class
│       ├── index.ts        # Scraper registry & runner
│       ├── tokyo-cheapo.ts
│       ├── japan-travel.ts
│       ├── ticket-pia.ts
│       ├── kabuki-bito.ts
│       └── tokyo-art-beat.ts
├── scripts/
│   ├── seed.ts             # Database seeder
│   └── scrape.ts           # CLI scraper runner
├── data/
│   └── events.db           # SQLite database (gitignored)
├── PLAN.md                 # This file
└── package.json
```
