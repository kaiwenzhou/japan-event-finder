import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class JapanTravelScraper extends BaseScraper {
  name = "Japan Travel";
  baseUrl = "https://en.japantravel.com";

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    // Scrape the events listing page
    const eventsUrl = `${this.baseUrl}/events`;
    const html = await this.fetch(eventsUrl);
    const $ = cheerio.load(html);

    // Japan Travel uses card-style layouts for events
    $(".event-card, .article-card, article[class*='event'], .listing-item").each((_, element) => {
      try {
        const $el = $(element);

        const titleEl = $el.find("h2, h3, .title, .card-title").first();
        const title = titleEl.text().trim();
        const link = titleEl.find("a").attr("href") || $el.find("a").first().attr("href");

        if (!title || !link) return;

        const fullUrl = link.startsWith("http") ? link : `${this.baseUrl}${link}`;

        // Extract date information
        const dateText = $el.find(".date, .event-date, time, .meta-info").text().trim();
        const locationText = $el.find(".location, .venue, .place, .region").text().trim();
        const description = $el.find(".description, .excerpt, .summary, p").first().text().trim();
        const imageUrl = $el.find("img").first().attr("src") ||
                        $el.find("img").first().attr("data-src") ||
                        null;

        const dateStart = this.parseDate(dateText) || new Date().toISOString().split("T")[0];
        const area = this.detectArea(locationText || title);
        const category = this.detectCategory(title + " " + description);

        events.push({
          id: this.generateId("jt", fullUrl),
          title_ja: title,
          title_en: title, // Japan Travel is in English
          description_ja: description || null,
          description_en: description || null,
          date_start: dateStart,
          date_end: null,
          venue_name: locationText || area,
          venue_address: null,
          area,
          category,
          tags: ["tourist-friendly", "english-info"],
          price_min: null,
          price_max: null,
          source_url: fullUrl,
          source_name: this.name,
          image_url: imageUrl,
        });
      } catch (error) {
        console.error("Error parsing Japan Travel event:", error);
      }
    });

    // Also try regional event pages
    const regions = ["tokyo", "osaka", "kyoto"];
    for (const region of regions) {
      try {
        const regionHtml = await this.fetch(`${this.baseUrl}/${region}/events`);
        const $region = cheerio.load(regionHtml);

        $region(".event-card, .article-card, article, .listing-item").each((_, element) => {
          try {
            const $el = $region(element);
            const titleEl = $el.find("h2, h3, .title").first();
            const title = titleEl.text().trim();
            const link = titleEl.find("a").attr("href") || $el.find("a").first().attr("href");

            if (!title || !link) return;

            const fullUrl = link.startsWith("http") ? link : `${this.baseUrl}${link}`;

            // Skip duplicates
            if (events.some(e => e.source_url === fullUrl)) return;

            const dateText = $el.find(".date, time").text().trim();
            const description = $el.find(".description, .excerpt, p").first().text().trim();
            const imageUrl = $el.find("img").first().attr("src") || null;

            events.push({
              id: this.generateId("jt", fullUrl),
              title_ja: title,
              title_en: title,
              description_ja: description || null,
              description_en: description || null,
              date_start: this.parseDate(dateText) || new Date().toISOString().split("T")[0],
              date_end: null,
              venue_name: region.charAt(0).toUpperCase() + region.slice(1),
              venue_address: null,
              area: region.charAt(0).toUpperCase() + region.slice(1),
              category: this.detectCategory(title + " " + description),
              tags: ["tourist-friendly", "english-info"],
              price_min: null,
              price_max: null,
              source_url: fullUrl,
              source_name: this.name,
              image_url: imageUrl,
            });
          } catch {
            // Skip individual errors
          }
        });
      } catch {
        // Skip region errors
      }
    }

    return events;
  }
}
