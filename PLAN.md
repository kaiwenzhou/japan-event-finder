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

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Backend | Python + FastAPI | Async-friendly, great for scraping |
| Database | SQLite (local) / PostgreSQL (prod) | Simple dev, scalable prod |
| Frontend | Next.js or plain HTML/JS | Vercel-friendly |
| Scrapers | Python + httpx + BeautifulSoup | Lightweight scraping |
| Translation | Google Translate API or DeepL | For JP → EN |
| Deployment | Vercel (frontend) + Railway/Fly.io (backend) | Or Vercel serverless for all |

### Alternative: All-in-One Vercel Approach
- Next.js full-stack app
- Vercel Postgres or Supabase for DB
- Vercel Cron for scheduled scraping
- API routes for backend logic

---

## Event Sources

### Priority 1 - Core Sources
| Source | URL | Category | Language |
|--------|-----|----------|----------|
| Ticket Pia | https://t.pia.jp/ | All tickets | JP |
| Japan Travel | https://en.japantravel.com/events | Tourist events | EN |
| Tokyo Cheapo | https://tokyocheapo.com/calendar/ | Budget events | EN |

### Priority 2 - Theatre & Traditional
| Source | URL | Category | Language |
|--------|-----|----------|----------|
| Kabuki-bito | https://www.kabuki-bito.jp/ | Kabuki | JP |
| Shochiku | https://www.shochiku.co.jp/ | Kabuki/Theatre | JP |
| Pia Stage | https://t.pia.jp/pia/events/stage/ | Stage/Musical | JP |
| Rakugo Kyokai | http://rakugo-kyokai.jp/ | Rakugo | JP |

### Priority 3 - Music & Orchestra
| Source | URL | Category | Language |
|--------|-----|----------|----------|
| NHK Symphony | https://www.nhkso.or.jp/ | Orchestra | JP |
| Tokyo Philharmonic | https://www.tpo.or.jp/ | Orchestra | JP |
| Billboard Live | https://www.billboard-live.com/ | Live music | JP/EN |

### Priority 4 - Anime & Pop Culture
| Source | URL | Category | Language |
|--------|-----|----------|----------|
| Parco | https://parco.jp/ | Anime collabs | JP |
| Animate | https://www.animate.co.jp/ | Anime events | JP |
| Tokyo Anime Center | Various | Anime | JP |

### Priority 5 - General/Backup
| Source | URL | Category | Language |
|--------|-----|----------|----------|
| Tokyo Art Beat | https://www.tokyoartbeat.com/ | Art/Culture | EN/JP |
| Live Japan | https://livejapan.com/ | Tourist | EN |
| Time Out Tokyo | https://www.timeout.com/tokyo | General | EN |

---

## Data Model

```python
class Event:
    id: str                    # Unique identifier
    title_ja: str              # Original Japanese title
    title_en: str | None       # Translated English title
    description_ja: str | None
    description_en: str | None

    date_start: datetime
    date_end: datetime | None

    venue_name: str
    venue_address: str | None
    area: str                  # Tokyo, Osaka, Kyoto, etc.

    category: str              # kabuki, orchestra, anime, musical, etc.
    tags: list[str]            # Additional tags

    price_min: int | None      # In JPY
    price_max: int | None

    source_url: str            # Original ticket/info page
    source_name: str           # e.g., "Ticket Pia"
    image_url: str | None

    created_at: datetime
    updated_at: datetime
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Vercel)                    │
│  Next.js / React                                         │
│  - Event list with filters                               │
│  - Date picker, location dropdown                        │
│  - Category tabs                                         │
│  - Toggle JP/EN display                                  │
│  - Click → original ticket site                          │
└─────────────────────────┬───────────────────────────────┘
                          │ API calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND API (Vercel/Railway)           │
│  FastAPI or Next.js API Routes                           │
│  - GET /events?date=&location=&category=                 │
│  - GET /events/:id                                       │
│  - POST /scrape/trigger (admin)                          │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      DATABASE                            │
│  SQLite (dev) / Vercel Postgres / Supabase (prod)        │
│  - events table                                          │
│  - sources table (scraper metadata)                      │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ Populate
┌─────────────────────────┴───────────────────────────────┐
│                   SCRAPER JOBS                           │
│  Python scripts / Vercel Cron                            │
│  - Run daily or on-demand                                │
│  - One scraper per source                                │
│  - Translate JP → EN via API                             │
│  - Dedupe events                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Set up Next.js project with TypeScript
- [ ] Set up database schema (SQLite for local dev)
- [ ] Create basic API routes for events
- [ ] Build simple UI with event list and filters

### Phase 2: Scrapers (Core Sources)
- [ ] Scraper for Ticket Pia (t.pia.jp)
- [ ] Scraper for Japan Travel Events
- [ ] Scraper for Tokyo Cheapo Calendar
- [ ] Translation integration (Google/DeepL)
- [ ] Manual trigger endpoint for scraping

### Phase 3: Expand Sources
- [ ] Kabuki/Theatre scrapers
- [ ] Orchestra scrapers
- [ ] Anime/Pop culture scrapers
- [ ] Deduplication logic

### Phase 4: Polish & Deploy
- [ ] Deploy frontend to Vercel
- [ ] Set up production database
- [ ] Configure Vercel Cron for scheduled scraping
- [ ] Add error handling and monitoring

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
     &location=tokyo
     &category=kabuki
     &search=keyword
     &page=1
     &limit=20

GET  /api/events/:id

GET  /api/categories
GET  /api/locations

POST /api/scrape/trigger   (protected, admin only)
GET  /api/scrape/status
```

---

## Notes & Considerations

### Scraping Challenges
- Some sites may block scrapers → use rotating user agents, delays
- JS-heavy sites may need Playwright instead of BeautifulSoup
- Rate limiting to be respectful to source sites
- Some sites may have anti-bot protection

### Translation
- Cache translations to avoid repeated API calls
- Consider fallback if translation API fails
- Keep original Japanese always available

### Legal
- Respect robots.txt
- Link back to original sources (don't republish full content)
- This is for personal use / aggregation, not commercial

---

## Getting Started (for future Claude sessions)

```bash
# Install dependencies
npm install        # Frontend
pip install -r requirements.txt  # Scrapers

# Run locally
npm run dev        # Frontend on localhost:3000

# Run scrapers manually
python scrapers/run_all.py

# Deploy
vercel deploy
```
