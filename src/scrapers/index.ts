import type { ScraperResult, ScrapedEvent } from "./base";
import { BaseScraper } from "./base";
import { TokyoCheapoScraper } from "./tokyo-cheapo";
import { JapanTravelScraper } from "./japan-travel";
import { TicketPiaScraper } from "./ticket-pia";
import { KabukiBitoScraper } from "./kabuki-bito";
import { TokyoArtBeatScraper } from "./tokyo-art-beat";
import { upsertEvent } from "@/lib/db";

export type { ScraperResult, ScrapedEvent };
export { BaseScraper };

// Registry of all available scrapers
export const scrapers: BaseScraper[] = [
  new TokyoCheapoScraper(),
  new JapanTravelScraper(),
  new TicketPiaScraper(),
  new KabukiBitoScraper(),
  new TokyoArtBeatScraper(),
];

export interface RunAllResult {
  results: ScraperResult[];
  totalEvents: number;
  totalErrors: number;
  totalDuration_ms: number;
}

export async function runAllScrapers(options?: {
  sources?: string[];
  saveToDb?: boolean;
}): Promise<RunAllResult> {
  const { sources, saveToDb = true } = options || {};

  const scrapersToRun = sources
    ? scrapers.filter((s) => sources.includes(s.name.toLowerCase().replace(/\s+/g, "-")))
    : scrapers;

  const startTime = Date.now();
  const results: ScraperResult[] = [];
  let totalEvents = 0;
  let totalErrors = 0;

  for (const scraper of scrapersToRun) {
    console.log(`Running scraper: ${scraper.name}...`);

    try {
      const result = await scraper.run();
      results.push(result);

      totalEvents += result.events.length;
      totalErrors += result.errors.length;

      console.log(`  Found ${result.events.length} events (${result.errors.length} errors)`);

      // Save events to database
      if (saveToDb && result.events.length > 0) {
        for (const event of result.events) {
          try {
            upsertEvent(event);
          } catch (error) {
            console.error(`  Error saving event ${event.id}:`, error);
            totalErrors++;
          }
        }
        console.log(`  Saved ${result.events.length} events to database`);
      }
    } catch (error) {
      console.error(`Error running scraper ${scraper.name}:`, error);
      results.push({
        source: scraper.name,
        events: [],
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: 0,
      });
      totalErrors++;
    }

    // Small delay between scrapers
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    results,
    totalEvents,
    totalErrors,
    totalDuration_ms: Date.now() - startTime,
  };
}

export async function runScraper(scraperName: string, saveToDb = true): Promise<ScraperResult> {
  const scraper = scrapers.find(
    (s) => s.name.toLowerCase().replace(/\s+/g, "-") === scraperName.toLowerCase()
  );

  if (!scraper) {
    return {
      source: scraperName,
      events: [],
      errors: [`Scraper not found: ${scraperName}`],
      duration_ms: 0,
    };
  }

  const result = await scraper.run();

  if (saveToDb && result.events.length > 0) {
    for (const event of result.events) {
      try {
        upsertEvent(event);
      } catch (error) {
        result.errors.push(`Error saving event ${event.id}: ${error}`);
      }
    }
  }

  return result;
}

// List available scrapers
export function listScrapers(): { name: string; key: string; baseUrl: string }[] {
  return scrapers.map((s) => ({
    name: s.name,
    key: s.name.toLowerCase().replace(/\s+/g, "-"),
    baseUrl: s.baseUrl,
  }));
}
