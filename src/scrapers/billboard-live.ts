import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class BillboardLiveScraper extends BaseScraper {
  name = "Billboard Live";
  baseUrl = "https://www.billboard-live.com";

  private venues = [
    { path: "/tokyo/", name: "Billboard Live Tokyo", area: "Tokyo", address: "東京都港区赤坂9-7-4" },
    { path: "/osaka/", name: "Billboard Live Osaka", area: "Osaka", address: "大阪市北区梅田2-2-22" },
    { path: "/yokohama/", name: "Billboard Live Yokohama", area: "Yokohama", address: "横浜市西区みなとみらい4-3-1" },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    for (const venue of this.venues) {
      try {
        const scheduleUrl = `${this.baseUrl}${venue.path}schedule/`;
        const html = await this.fetch(scheduleUrl);
        const $ = cheerio.load(html);

        // Billboard Live uses various list formats
        $(".schedule-item, .live-item, .event-card, article, .performance, li.live").each((_, element) => {
          try {
            const $el = $(element);

            const titleEl = $el.find("h2, h3, .artist-name, .title, .live-title a").first();
            const title = titleEl.text().trim() || $el.find("a").first().text().trim();
            const link = titleEl.attr("href") || $el.find("a").first().attr("href");

            if (!title || title.length < 2) return;

            const fullUrl = link
              ? link.startsWith("http") ? link : `${this.baseUrl}${link}`
              : scheduleUrl;

            // Skip duplicates
            if (events.some((e) => e.source_url === fullUrl)) return;

            const dateText = $el.find(".date, .live-date, time, .schedule-date").text().trim();
            const timeText = $el.find(".time, .show-time, .open-start").text().trim();
            const priceText = $el.find(".price, .ticket-price, .charge").text().trim();
            const imageUrl = $el.find("img").first().attr("src") || null;

            const dateStart = this.parseDateStr(dateText);

            // Parse price range
            const prices = this.parsePrices(priceText);

            events.push({
              id: this.generateId("billboard", fullUrl),
              title_ja: title,
              title_en: this.isEnglishText(title) ? title : null,
              description_ja: timeText ? `開場/開演: ${timeText}` : null,
              description_en: null,
              date_start: dateStart || new Date().toISOString().split("T")[0],
              date_end: null,
              venue_name: venue.name,
              venue_address: venue.address,
              area: venue.area,
              category: "concert",
              tags: ["live", "music", "jazz", "pop"],
              price_min: prices.min,
              price_max: prices.max,
              source_url: fullUrl,
              source_name: this.name,
              image_url: imageUrl,
            });
          } catch (error) {
            console.error("Error parsing Billboard Live event:", error);
          }
        });

        // Small delay between venue requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error fetching Billboard Live ${venue.name}:`, error);
      }
    }

    return events;
  }

  private parseDateStr(dateStr: string): string | null {
    if (!dateStr) return null;

    const now = new Date();
    const currentYear = now.getFullYear();

    // Pattern: 2025.1.15 or 2025/1/15
    const fullMatch = dateStr.match(/(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})/);
    if (fullMatch) {
      const [, year, month, day] = fullMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Pattern: 1.15(水) or 1/15
    const shortMatch = dateStr.match(/(\d{1,2})[.\/](\d{1,2})/);
    if (shortMatch) {
      const [, month, day] = shortMatch;
      let year = currentYear;
      if (parseInt(month) < now.getMonth() + 1) {
        year++;
      }
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Pattern: 1月15日
    const jpMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
    if (jpMatch) {
      const [, month, day] = jpMatch;
      let year = currentYear;
      if (parseInt(month) < now.getMonth() + 1) {
        year++;
      }
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return null;
  }

  private parsePrices(priceStr: string): { min: number | null; max: number | null } {
    if (!priceStr) return { min: null, max: null };

    // Remove yen symbols and commas, extract numbers
    const numbers = priceStr.replace(/[¥￥,]/g, "").match(/\d+/g);
    if (!numbers) return { min: null, max: null };

    // Filter reasonable prices (typically 5000-20000 yen for Billboard Live)
    const prices = numbers
      .map((n) => parseInt(n, 10))
      .filter((n) => n >= 1000 && n <= 50000);

    if (prices.length === 0) return { min: null, max: null };
    if (prices.length === 1) return { min: prices[0], max: prices[0] };

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }

  private isEnglishText(text: string): boolean {
    // Check if text is primarily English (ASCII letters)
    const englishChars = text.match(/[a-zA-Z]/g) || [];
    const totalChars = text.replace(/\s/g, "").length;
    return totalChars > 0 && englishChars.length / totalChars > 0.5;
  }
}
