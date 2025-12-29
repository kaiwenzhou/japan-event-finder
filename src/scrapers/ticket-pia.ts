import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class TicketPiaScraper extends BaseScraper {
  name = "Ticket Pia";
  baseUrl = "https://t.pia.jp";

  private categories = [
    { path: "/pia/events/music/", category: "concert" },
    { path: "/pia/events/classic/", category: "orchestra" },
    { path: "/pia/events/stage/", category: "theatre" },
    { path: "/pia/events/musical/", category: "musical" },
    { path: "/pia/events/rakugo/", category: "rakugo" },
    { path: "/pia/events/anime/", category: "anime" },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    for (const { path, category } of this.categories) {
      try {
        const url = `${this.baseUrl}${path}`;
        const html = await this.fetch(url);
        const $ = cheerio.load(html);

        // Ticket Pia typically uses list or card layouts
        $(".event-list-item, .eventCard, .event-item, article, .search-result-item, li[class*='event']").each(
          (_, element) => {
            try {
              const $el = $(element);

              // Extract title
              const titleEl = $el.find("h2, h3, .event-title, .title, a[class*='title']").first();
              const title = titleEl.text().trim() || $el.find("a").first().text().trim();

              if (!title || title.length < 2) return;

              // Extract link
              let link = titleEl.attr("href") || titleEl.find("a").attr("href") || $el.find("a").first().attr("href");
              if (!link) return;

              const fullUrl = link.startsWith("http") ? link : `${this.baseUrl}${link}`;

              // Skip duplicates
              if (events.some((e) => e.source_url === fullUrl)) return;

              // Extract other details
              const dateText = $el.find(".date, .event-date, .schedule, time").text().trim();
              const venueText = $el.find(".venue, .place, .location, .hall").text().trim();
              const priceText = $el.find(".price, .ticket-price").text().trim();
              const imageUrl = $el.find("img").first().attr("src") ||
                              $el.find("img").first().attr("data-src") ||
                              null;

              // Parse Japanese date formats (e.g., "2025年1月15日", "1/15(水)")
              let dateStart = this.parseJapaneseDate(dateText);
              if (!dateStart) {
                dateStart = new Date().toISOString().split("T")[0];
              }

              const area = this.detectArea(venueText || title);

              // Parse price range
              const prices = this.parsePriceRange(priceText);

              events.push({
                id: this.generateId("pia", fullUrl),
                title_ja: title,
                title_en: null, // Will be translated later
                description_ja: null,
                description_en: null,
                date_start: dateStart,
                date_end: null,
                venue_name: venueText || "会場未定",
                venue_address: null,
                area,
                category,
                tags: [category, "tickets-available"],
                price_min: prices.min,
                price_max: prices.max,
                source_url: fullUrl,
                source_name: this.name,
                image_url: imageUrl,
              });
            } catch (error) {
              console.error("Error parsing Ticket Pia event:", error);
            }
          }
        );

        // Add delay between category requests to be respectful
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error scraping Ticket Pia category ${category}:`, error);
      }
    }

    return events;
  }

  private parseJapaneseDate(dateStr: string): string | null {
    if (!dateStr) return null;

    // Pattern: 2025年1月15日
    const fullMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (fullMatch) {
      const [, year, month, day] = fullMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Pattern: 1/15 or 01/15 (assume current/next year)
    const shortMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
    if (shortMatch) {
      const [, month, day] = shortMatch;
      const now = new Date();
      let year = now.getFullYear();

      // If month is before current month, assume next year
      if (parseInt(month) < now.getMonth() + 1) {
        year++;
      }

      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return null;
  }

  private parsePriceRange(priceStr: string): { min: number | null; max: number | null } {
    if (!priceStr) return { min: null, max: null };

    // Remove commas and extract all numbers
    const numbers = priceStr.replace(/,/g, "").match(/\d+/g);
    if (!numbers) return { min: null, max: null };

    const prices = numbers.map((n) => parseInt(n, 10)).filter((n) => n >= 100); // Filter out non-price numbers

    if (prices.length === 0) return { min: null, max: null };
    if (prices.length === 1) return { min: prices[0], max: prices[0] };

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }
}
