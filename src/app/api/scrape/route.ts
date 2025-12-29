import { NextRequest, NextResponse } from "next/server";
import { runAllScrapers, runScraper, listScrapers } from "@/scrapers";

// GET /api/scrape - List available scrapers
export async function GET() {
  const scrapers = listScrapers();
  return NextResponse.json({
    scrapers,
    usage: {
      runAll: "POST /api/scrape",
      runOne: "POST /api/scrape?source=tokyo-cheapo",
      listScrapers: "GET /api/scrape",
    },
  });
}

// POST /api/scrape - Run scrapers
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get("source");
  const saveToDb = searchParams.get("save") !== "false";

  // Optional: Add basic auth protection
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.SCRAPE_API_KEY;

  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json(
      { error: "Unauthorized. Provide valid API key in Authorization header." },
      { status: 401 }
    );
  }

  try {
    if (source) {
      // Run single scraper
      console.log(`Running scraper: ${source}`);
      const result = await runScraper(source, saveToDb);

      return NextResponse.json({
        success: result.errors.length === 0,
        source: result.source,
        eventsFound: result.events.length,
        errors: result.errors,
        duration_ms: result.duration_ms,
      });
    } else {
      // Run all scrapers
      console.log("Running all scrapers...");
      const result = await runAllScrapers({ saveToDb });

      return NextResponse.json({
        success: result.totalErrors === 0,
        totalEvents: result.totalEvents,
        totalErrors: result.totalErrors,
        duration_ms: result.totalDuration_ms,
        results: result.results.map((r) => ({
          source: r.source,
          eventsFound: r.events.length,
          errors: r.errors,
          duration_ms: r.duration_ms,
        })),
      });
    }
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
