#!/usr/bin/env tsx

import { runAllScrapers, runScraper, listScrapers } from "../src/scrapers";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "list") {
    console.log("\nAvailable scrapers:");
    console.log("==================");
    for (const scraper of listScrapers()) {
      console.log(`  ${scraper.key.padEnd(20)} ${scraper.name} (${scraper.baseUrl})`);
    }
    console.log("\nUsage:");
    console.log("  npm run scrape           # Run all scrapers");
    console.log("  npm run scrape list      # List available scrapers");
    console.log("  npm run scrape <source>  # Run specific scraper");
    console.log("\nExample:");
    console.log("  npm run scrape tokyo-cheapo");
    return;
  }

  if (command) {
    // Run specific scraper
    console.log(`\nRunning scraper: ${command}`);
    console.log("=".repeat(40));

    const result = await runScraper(command, true);

    console.log(`\nResults for ${result.source}:`);
    console.log(`  Events found: ${result.events.length}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Duration: ${result.duration_ms}ms`);

    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }

    if (result.events.length > 0) {
      console.log("\nSample events:");
      result.events.slice(0, 3).forEach((e) => {
        console.log(`  - ${e.title_ja || e.title_en} (${e.category})`);
        console.log(`    ${e.date_start} @ ${e.venue_name}`);
      });
    }
  } else {
    // Run all scrapers
    console.log("\nRunning all scrapers...");
    console.log("=".repeat(40));

    const result = await runAllScrapers({ saveToDb: true });

    console.log("\n" + "=".repeat(40));
    console.log("SUMMARY");
    console.log("=".repeat(40));
    console.log(`Total events: ${result.totalEvents}`);
    console.log(`Total errors: ${result.totalErrors}`);
    console.log(`Total time: ${(result.totalDuration_ms / 1000).toFixed(1)}s`);

    console.log("\nPer source:");
    for (const r of result.results) {
      const status = r.errors.length === 0 ? "✓" : "✗";
      console.log(`  ${status} ${r.source.padEnd(20)} ${r.events.length} events (${r.errors.length} errors)`);
    }
  }
}

main().catch(console.error);
