import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class NHKSymphonyScraper extends BaseScraper {
  name = "NHK Symphony";
  baseUrl = "https://www.nhkso.or.jp";

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    try {
      // Concert schedule page
      const html = await this.fetch(`${this.baseUrl}/concert/`);
      const $ = cheerio.load(html);

      // NHK Symphony typically lists concerts in a schedule format
      $(".concert-item, .schedule-item, article, .concert-list li, .event-item").each((_, element) => {
        try {
          const $el = $(element);

          const titleEl = $el.find("h2, h3, .title, .concert-title, a").first();
          const title = titleEl.text().trim();
          const link = titleEl.attr("href") || $el.find("a").first().attr("href");

          if (!title || title.length < 3) return;

          const fullUrl = link
            ? link.startsWith("http") ? link : `${this.baseUrl}${link}`
            : `${this.baseUrl}/concert/`;

          // Skip duplicates
          if (events.some((e) => e.source_url === fullUrl && e.title_ja === title)) return;

          const dateText = $el.find(".date, .concert-date, time, .schedule-date").text().trim();
          const venueText = $el.find(".venue, .hall, .place, .location").text().trim();
          const programText = $el.find(".program, .description, .conductor, p").text().trim();

          const dateStart = this.parseJapaneseDate(dateText);

          events.push({
            id: this.generateId("nhkso", fullUrl + title),
            title_ja: title,
            title_en: null,
            description_ja: programText || null,
            description_en: null,
            date_start: dateStart || new Date().toISOString().split("T")[0],
            date_end: null,
            venue_name: venueText || "NHKホール",
            venue_address: "東京都渋谷区神南2-2-1",
            area: "Tokyo",
            category: "orchestra",
            tags: ["classical", "orchestra", "symphony"],
            price_min: 5000,
            price_max: 15000,
            source_url: fullUrl,
            source_name: this.name,
            image_url: null,
          });
        } catch (error) {
          console.error("Error parsing NHK Symphony event:", error);
        }
      });

      // Also try the English page
      try {
        const enHtml = await this.fetch(`${this.baseUrl}/en/concert/`);
        const $en = cheerio.load(enHtml);

        $en(".concert-item, article, .event-item").each((_, element) => {
          try {
            const $el = $en(element);
            const title = $el.find("h2, h3, .title").first().text().trim();
            const link = $el.find("a").first().attr("href");

            if (!title) return;

            const fullUrl = link
              ? link.startsWith("http") ? link : `${this.baseUrl}${link}`
              : `${this.baseUrl}/en/concert/`;

            // Update English title for matching events
            const matchingEvent = events.find(
              (e) => e.source_url === fullUrl || this.titlesMatch(e.title_ja, title)
            );
            if (matchingEvent && !matchingEvent.title_en) {
              matchingEvent.title_en = title;
            }
          } catch {
            // Skip individual errors
          }
        });
      } catch {
        // English page might not exist
      }
    } catch (error) {
      console.error("Error fetching NHK Symphony:", error);
    }

    return events;
  }

  private parseJapaneseDate(dateStr: string): string | null {
    if (!dateStr) return null;

    const now = new Date();
    const currentYear = now.getFullYear();

    // Pattern: 2025年1月15日
    const fullMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (fullMatch) {
      const [, year, month, day] = fullMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Pattern: 1月15日
    const shortMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
    if (shortMatch) {
      const [, month, day] = shortMatch;
      let year = currentYear;
      if (parseInt(month) < now.getMonth() + 1) {
        year++;
      }
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return null;
  }

  private titlesMatch(ja: string, en: string): boolean {
    // Simple check if titles might refer to the same concert
    // by looking for common patterns like dates or numbers
    const jaNumbers: string[] = ja.match(/\d+/g) || [];
    const enNumbers: string[] = en.match(/\d+/g) || [];
    return jaNumbers.some((n) => enNumbers.includes(n));
  }
}
