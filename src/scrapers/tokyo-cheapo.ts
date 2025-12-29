import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class TokyoCheapoScraper extends BaseScraper {
  name = "Tokyo Cheapo";
  baseUrl = "https://tokyocheapo.com";

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    // Scrape the calendar page
    const calendarUrl = `${this.baseUrl}/events/`;
    const html = await this.fetch(calendarUrl);
    const $ = cheerio.load(html);

    // Find event cards - Tokyo Cheapo uses article elements for events
    $("article.post, .event-card, .tc-event").each((_, element) => {
      try {
        const $el = $(element);

        // Try different selectors based on page structure
        const title = $el.find("h2 a, h3 a, .event-title a").first().text().trim() ||
                     $el.find("a.title, .entry-title a").first().text().trim();

        const link = $el.find("h2 a, h3 a, .event-title a, a.title, .entry-title a").first().attr("href");

        if (!title || !link) return;

        const dateText = $el.find(".event-date, .date, time, .meta-date").text().trim();
        const venueText = $el.find(".event-venue, .venue, .location").text().trim();
        const description = $el.find(".excerpt, .event-excerpt, .entry-summary p").text().trim();
        const imageUrl = $el.find("img").first().attr("src") || null;
        const priceText = $el.find(".price, .event-price").text().trim();

        const fullUrl = link.startsWith("http") ? link : `${this.baseUrl}${link}`;
        const dateStart = this.parseDate(dateText) || new Date().toISOString().split("T")[0];
        const area = this.detectArea(venueText || title);
        const category = this.detectCategory(title + " " + description);

        events.push({
          id: this.generateId("tc", fullUrl),
          title_ja: title, // Tokyo Cheapo is in English, so same for both
          title_en: title,
          description_ja: description || null,
          description_en: description || null,
          date_start: dateStart,
          date_end: null,
          venue_name: venueText || "Various locations",
          venue_address: null,
          area,
          category,
          tags: ["budget-friendly"],
          price_min: this.parsePrice(priceText),
          price_max: null,
          source_url: fullUrl,
          source_name: this.name,
          image_url: imageUrl,
        });
      } catch (error) {
        console.error("Error parsing Tokyo Cheapo event:", error);
      }
    });

    // Also try to get events from their dedicated calendar view
    try {
      const calendarHtml = await this.fetch(`${this.baseUrl}/calendar/`);
      const $calendar = cheerio.load(calendarHtml);

      $calendar(".calendar-event, .fc-event, [data-event]").each((_, element) => {
        try {
          const $el = $calendar(element);
          const title = $el.text().trim() || $el.attr("title") || "";
          const link = $el.attr("href") || $el.find("a").attr("href");

          if (!title || !link) return;

          const fullUrl = link.startsWith("http") ? link : `${this.baseUrl}${link}`;

          // Avoid duplicates
          if (events.some(e => e.source_url === fullUrl)) return;

          events.push({
            id: this.generateId("tc", fullUrl),
            title_ja: title,
            title_en: title,
            description_ja: null,
            description_en: null,
            date_start: new Date().toISOString().split("T")[0],
            date_end: null,
            venue_name: "Tokyo",
            venue_address: null,
            area: "Tokyo",
            category: this.detectCategory(title),
            tags: ["budget-friendly"],
            price_min: null,
            price_max: null,
            source_url: fullUrl,
            source_name: this.name,
            image_url: null,
          });
        } catch {
          // Skip individual event errors
        }
      });
    } catch {
      // Calendar page might not exist or have different structure
    }

    return events;
  }
}
