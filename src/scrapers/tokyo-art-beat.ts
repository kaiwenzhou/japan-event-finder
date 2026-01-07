import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class TokyoArtBeatScraper extends BaseScraper {
  name = "Tokyo Art Beat";
  baseUrl = "https://www.tokyoartbeat.com";

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    // Tokyo Art Beat has both English and Japanese versions
    const urls = [
      `${this.baseUrl}/en/events`,
      `${this.baseUrl}/events`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetch(url);
        const $ = cheerio.load(html);
        const isEnglish = url.includes("/en/");

        // TAB uses card layouts for exhibitions
        $(".event-card, .exhibition-card, article, .listing-item, .event-item").each((_, element) => {
          try {
            const $el = $(element);

            const titleEl = $el.find("h2, h3, .title, .event-title").first();
            const title = titleEl.text().trim();
            const link = titleEl.find("a").attr("href") || $el.find("a").first().attr("href");

            if (!title || !link) return;

            const fullUrl = link.startsWith("http") ? link : `${this.baseUrl}${link}`;

            // Skip if already added from the other language version
            if (events.some((e) => e.source_url === fullUrl || e.title_ja === title || e.title_en === title)) {
              // Update English title if we have it
              if (isEnglish) {
                const existing = events.find((e) => e.source_url === fullUrl);
                if (existing && !existing.title_en) {
                  existing.title_en = title;
                }
              }
              return;
            }

            const dateText = $el.find(".date, .period, time, .event-date").text().trim();
            const venueText = $el.find(".venue, .location, .gallery, .museum").text().trim();
            const description = $el.find(".description, .excerpt, p").first().text().trim();
            const imageUrl = $el.find("img").first().attr("src") ||
                            $el.find("img").first().attr("data-src") ||
                            null;

            const dates = this.parseExhibitionDates(dateText);
            const area = this.detectArea(venueText || title);

            events.push({
              id: this.generateId("tab", fullUrl),
              title_ja: isEnglish ? title : title, // Will get JP version from other URL
              title_en: isEnglish ? title : null,
              description_ja: isEnglish ? null : description,
              description_en: isEnglish ? description : null,
              date_start: dates.start,
              date_end: dates.end,
              venue_name: venueText || "Gallery",
              venue_address: null,
              area,
              category: "art",
              tags: ["art", "exhibition", "museum"],
              price_min: null,
              price_max: null,
              source_url: fullUrl,
              source_name: this.name,
              image_url: imageUrl,
            });
          } catch (error) {
            console.error("Error parsing Tokyo Art Beat event:", error);
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error fetching Tokyo Art Beat ${url}:`, error);
      }
    }

    return events;
  }

  private parseExhibitionDates(dateStr: string): { start: string; end: string | null } {
    const now = new Date();
    const currentYear = now.getFullYear();

    // English pattern: "Jan 15 - Feb 28, 2025" or "January 15 - February 28"
    const enRangeMatch = dateStr.match(
      /(\w+)\s+(\d{1,2})(?:,?\s+\d{4})?\s*[-–]\s*(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?/i
    );
    if (enRangeMatch) {
      const [, startMonth, startDay, endMonth, endDay, year] = enRangeMatch;
      const startDate = new Date(`${startMonth} ${startDay}, ${year || currentYear}`);
      const endDate = new Date(`${endMonth} ${endDay}, ${year || currentYear}`);

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        return {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        };
      }
    }

    // Japanese pattern: 2025年1月15日〜2月28日
    const jpRangeMatch = dateStr.match(
      /(\d{4})年(\d{1,2})月(\d{1,2})日[〜～\-–](?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/
    );
    if (jpRangeMatch) {
      const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = jpRangeMatch;
      return {
        start: `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}`,
        end: `${endYear || startYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}`,
      };
    }

    // Single date
    const singleMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) ||
                       dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (singleMatch) {
      if (singleMatch[0].includes("年")) {
        const [, year, month, day] = singleMatch;
        return {
          start: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
          end: null,
        };
      } else {
        const date = new Date(singleMatch[0]);
        if (!isNaN(date.getTime())) {
          return {
            start: date.toISOString().split("T")[0],
            end: null,
          };
        }
      }
    }

    return {
      start: now.toISOString().split("T")[0],
      end: null,
    };
  }
}
