import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class KabukiBitoScraper extends BaseScraper {
  name = "Kabuki-bito";
  baseUrl = "https://www.kabuki-bito.jp";

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    // Main theaters page
    const theatersUrl = `${this.baseUrl}/theaters/`;

    try {
      const html = await this.fetch(theatersUrl);
      const $ = cheerio.load(html);

      // Kabuki-bito lists performances by theater
      $(".theater-section, .performance-list, article, .kouen-item, .play-item").each((_, element) => {
        try {
          const $el = $(element);

          const title = $el.find("h2, h3, .title, .kouen-title, .play-title").first().text().trim();
          const link = $el.find("a").first().attr("href");

          if (!title || !link) return;

          const fullUrl = link.startsWith("http") ? link : `${this.baseUrl}${link}`;

          const dateText = $el.find(".date, .period, .schedule, .kouen-date").text().trim();
          const venueText = $el.find(".theater, .venue, .hall, .kouen-theater").text().trim();
          const priceText = $el.find(".price, .ticket-price").text().trim();
          const imageUrl = $el.find("img").first().attr("src") || null;

          // Parse date range for kabuki (often month-long runs)
          const dates = this.parseKabukiDateRange(dateText);

          events.push({
            id: this.generateId("kabuki", fullUrl),
            title_ja: title,
            title_en: null,
            description_ja: null,
            description_en: null,
            date_start: dates.start,
            date_end: dates.end,
            venue_name: venueText || "歌舞伎座",
            venue_address: null,
            area: this.detectKabukiArea(venueText),
            category: "kabuki",
            tags: ["traditional", "kabuki", "theatre"],
            price_min: this.parsePrice(priceText),
            price_max: null,
            source_url: fullUrl,
            source_name: this.name,
            image_url: imageUrl,
          });
        } catch (error) {
          console.error("Error parsing Kabuki-bito event:", error);
        }
      });
    } catch (error) {
      console.error("Error fetching Kabuki-bito theaters:", error);
    }

    // Also try the schedule/calendar page
    try {
      const scheduleHtml = await this.fetch(`${this.baseUrl}/schedule/`);
      const $schedule = cheerio.load(scheduleHtml);

      $schedule(".schedule-item, .calendar-event, tr, .performance").each((_, element) => {
        try {
          const $el = $schedule(element);
          const title = $el.find("td, .title, a").first().text().trim();
          const link = $el.find("a").attr("href");

          if (!title || title.length < 3) return;

          const fullUrl = link ? (link.startsWith("http") ? link : `${this.baseUrl}${link}`) : `${this.baseUrl}/schedule/`;

          // Skip duplicates
          if (events.some((e) => e.title_ja === title)) return;

          const dateText = $el.find(".date, time, td:first-child").text().trim();
          const venueText = $el.find(".venue, .theater, td:nth-child(2)").text().trim();

          const dates = this.parseKabukiDateRange(dateText);

          events.push({
            id: this.generateId("kabuki", fullUrl + title),
            title_ja: title,
            title_en: null,
            description_ja: null,
            description_en: null,
            date_start: dates.start,
            date_end: dates.end,
            venue_name: venueText || "歌舞伎座",
            venue_address: null,
            area: this.detectKabukiArea(venueText),
            category: "kabuki",
            tags: ["traditional", "kabuki", "theatre"],
            price_min: null,
            price_max: null,
            source_url: fullUrl,
            source_name: this.name,
            image_url: null,
          });
        } catch {
          // Skip individual errors
        }
      });
    } catch {
      // Schedule page might not exist
    }

    return events;
  }

  private parseKabukiDateRange(dateStr: string): { start: string; end: string | null } {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Pattern: 1月2日〜26日 or 1月2日～26日
    const rangeMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日[〜～\-](\d{1,2})日/);
    if (rangeMatch) {
      const [, month, startDay, endDay] = rangeMatch;
      return {
        start: `${currentYear}-${month.padStart(2, "0")}-${startDay.padStart(2, "0")}`,
        end: `${currentYear}-${month.padStart(2, "0")}-${endDay.padStart(2, "0")}`,
      };
    }

    // Pattern: 1月2日〜2月15日
    const fullRangeMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日[〜～\-](\d{1,2})月(\d{1,2})日/);
    if (fullRangeMatch) {
      const [, startMonth, startDay, endMonth, endDay] = fullRangeMatch;
      let endYear = currentYear;
      if (parseInt(endMonth) < parseInt(startMonth)) {
        endYear++;
      }
      return {
        start: `${currentYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}`,
        end: `${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}`,
      };
    }

    // Single date: 1月15日
    const singleMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
    if (singleMatch) {
      const [, month, day] = singleMatch;
      return {
        start: `${currentYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
        end: null,
      };
    }

    return {
      start: now.toISOString().split("T")[0],
      end: null,
    };
  }

  private detectKabukiArea(venueText: string): string {
    const venues: Record<string, string> = {
      歌舞伎座: "Tokyo",
      新橋演舞場: "Tokyo",
      国立劇場: "Tokyo",
      明治座: "Tokyo",
      浅草公会堂: "Tokyo",
      南座: "Kyoto",
      松竹座: "Osaka",
      御園座: "Nagoya",
      博多座: "Fukuoka",
    };

    for (const [venue, area] of Object.entries(venues)) {
      if (venueText.includes(venue)) {
        return area;
      }
    }

    return this.detectArea(venueText);
  }
}
