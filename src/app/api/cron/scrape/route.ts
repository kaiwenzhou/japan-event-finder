import { NextRequest, NextResponse } from "next/server";
import { runAllScrapers } from "@/scrapers";

export const maxDuration = 300; // 5 minutes max for Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");

  // In production, verify CRON_SECRET
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  console.log("Starting scheduled scrape job...");

  try {
    const result = await runAllScrapers({ saveToDb: true });

    console.log(`Scrape complete: ${result.totalEvents} events, ${result.totalErrors} errors`);

    return NextResponse.json({
      success: true,
      message: "Scheduled scrape completed",
      totalEvents: result.totalEvents,
      totalErrors: result.totalErrors,
      duration_ms: result.totalDuration_ms,
      sources: result.results.map((r) => ({
        name: r.source,
        events: r.events.length,
        errors: r.errors.length,
      })),
    });
  } catch (error) {
    console.error("Scheduled scrape failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
