import * as cheerio from "cheerio";
import { BaseScraper, ScrapedEvent } from "./base";

export class ParcoScraper extends BaseScraper {
  name = "Parco";
  baseUrl = "https://art.parco.jp";

  // Parco locations with anime/pop culture events
  private locations = [
    { name: "渋谷PARCO", area: "Tokyo", address: "東京都渋谷区宇田川町15-1" },
    { name: "池袋PARCO", area: "Tokyo", address: "東京都豊島区南池袋1-28-2" },
    { name: "名古屋PARCO", area: "Nagoya", address: "名古屋市中区栄3-29-1" },
    { name: "心斎橋PARCO", area: "Osaka", address: "大阪市中央区心斎橋筋1-8-3" },
    { name: "福岡PARCO", area: "Fukuoka", address: "福岡市中央区天神2-11-1" },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    try {
      // Main art/exhibition page
      const html = await this.fetch(`${this.baseUrl}/`);
      const $ = cheerio.load(html);

      // Parco art site lists exhibitions and pop-up events
      $(".exhibition-item, .event-card, article, .news-item, .pickup-item").each((_, element) => {
        try {
          const $el = $(element);

          const titleEl = $el.find("h2, h3, .title, a.title, .event-title").first();
          const title = titleEl.text().trim() || $el.find("a").first().text().trim();
          const link = titleEl.attr("href") || $el.find("a").first().attr("href");

          if (!title || title.length < 3) return;

          const fullUrl = link
            ? link.startsWith("http") ? link : `${this.baseUrl}${link}`
            : this.baseUrl;

          // Skip duplicates
          if (events.some((e) => e.source_url === fullUrl)) return;

          const dateText = $el.find(".date, .period, .schedule, time").text().trim();
          const venueText = $el.find(".venue, .place, .location, .shop").text().trim();
          const description = $el.find(".description, .excerpt, .text, p").first().text().trim();
          const imageUrl = $el.find("img").first().attr("src") ||
                          $el.find("img").first().attr("data-src") ||
                          null;

          const dates = this.parseDateRange(dateText);
          const location = this.matchLocation(venueText || title);
          const category = this.detectEventType(title + " " + description);

          events.push({
            id: this.generateId("parco", fullUrl),
            title_ja: title,
            title_en: null,
            description_ja: description || null,
            description_en: null,
            date_start: dates.start,
            date_end: dates.end,
            venue_name: location?.name || venueText || "PARCO",
            venue_address: location?.address || null,
            area: location?.area || "Tokyo",
            category,
            tags: this.generateTags(title, description),
            price_min: null,
            price_max: null,
            source_url: fullUrl,
            source_name: this.name,
            image_url: imageUrl,
          });
        } catch (error) {
          console.error("Error parsing Parco event:", error);
        }
      });

      // Also check Shibuya Parco specifically (known for anime collabs)
      try {
        const shibuyaHtml = await this.fetch("https://shibuya.parco.jp/event/");
        const $shibuya = cheerio.load(shibuyaHtml);

        $shibuya(".event-item, article, .card, .list-item").each((_, element) => {
          try {
            const $el = $shibuya(element);
            const title = $el.find("h2, h3, .title, a").first().text().trim();
            const link = $el.find("a").first().attr("href");

            if (!title || title.length < 3) return;

            const fullUrl = link
              ? link.startsWith("http") ? link : `https://shibuya.parco.jp${link}`
              : "https://shibuya.parco.jp/event/";

            // Skip duplicates
            if (events.some((e) => e.source_url === fullUrl || e.title_ja === title)) return;

            const dateText = $el.find(".date, .period, time").text().trim();
            const floorText = $el.find(".floor, .shop, .location").text().trim();
            const imageUrl = $el.find("img").first().attr("src") || null;

            const dates = this.parseDateRange(dateText);
            const category = this.detectEventType(title);

            events.push({
              id: this.generateId("parco-shibuya", fullUrl),
              title_ja: title,
              title_en: null,
              description_ja: floorText || null,
              description_en: null,
              date_start: dates.start,
              date_end: dates.end,
              venue_name: "渋谷PARCO" + (floorText ? ` ${floorText}` : ""),
              venue_address: "東京都渋谷区宇田川町15-1",
              area: "Tokyo",
              category,
              tags: this.generateTags(title, ""),
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
        // Shibuya Parco page might have different structure
      }
    } catch (error) {
      console.error("Error fetching Parco:", error);
    }

    return events;
  }

  private parseDateRange(dateStr: string): { start: string; end: string | null } {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Pattern: 2025.1.15(水)～2.28(金) or 2025年1月15日〜2月28日
    const rangeMatch = dateStr.match(
      /(\d{4})?[年.]?(\d{1,2})[月.](\d{1,2})日?[（(]?[月火水木金土日]?[）)]?[〜～\-–](\d{1,2})?[月.]?(\d{1,2})日?/
    );
    if (rangeMatch) {
      const [, year, startMonth, startDay, endMonthOrDay, endDay] = rangeMatch;
      const startYear = year ? parseInt(year) : currentYear;
      let endMonth = startMonth;
      let actualEndDay = endDay;

      if (endDay) {
        endMonth = endMonthOrDay;
        actualEndDay = endDay;
      } else {
        actualEndDay = endMonthOrDay;
      }

      return {
        start: `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}`,
        end: actualEndDay
          ? `${startYear}-${endMonth.padStart(2, "0")}-${actualEndDay.padStart(2, "0")}`
          : null,
      };
    }

    // Single date
    const singleMatch = dateStr.match(/(\d{4})?[年.]?(\d{1,2})[月.](\d{1,2})/);
    if (singleMatch) {
      const [, year, month, day] = singleMatch;
      const startYear = year ? parseInt(year) : currentYear;
      return {
        start: `${startYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
        end: null,
      };
    }

    return {
      start: now.toISOString().split("T")[0],
      end: null,
    };
  }

  private matchLocation(text: string): { name: string; area: string; address: string } | null {
    for (const loc of this.locations) {
      if (text.includes(loc.name) || text.includes(loc.name.replace("PARCO", "パルコ"))) {
        return loc;
      }
    }
    // Check for area names
    if (text.includes("渋谷") || text.includes("shibuya")) {
      return this.locations[0];
    }
    if (text.includes("池袋") || text.includes("ikebukuro")) {
      return this.locations[1];
    }
    return null;
  }

  private detectEventType(text: string): string {
    const lowerText = text.toLowerCase();

    // Anime/manga keywords
    if (
      /アニメ|anime|漫画|manga|コラボ|collab|キャラクター|character|ポップアップ|pop.?up|グッズ|goods/.test(
        lowerText
      )
    ) {
      return "anime";
    }

    // Art/exhibition
    if (/展|exhibition|アート|art|ギャラリー|gallery/.test(lowerText)) {
      return "art";
    }

    // Fashion/shopping
    if (/ファッション|fashion|ショップ|shop|ストア|store/.test(lowerText)) {
      return "event";
    }

    return "event";
  }

  private generateTags(title: string, description: string): string[] {
    const tags: string[] = [];
    const text = (title + " " + description).toLowerCase();

    // Detect anime/manga titles (common patterns)
    const animeKeywords = [
      "呪術廻戦", "jujutsu", "鬼滅", "demon slayer", "ワンピース", "one piece",
      "スパイファミリー", "spy family", "ブルーロック", "blue lock",
      "進撃", "attack on titan", "ハイキュー", "haikyu", "推しの子", "oshi no ko",
      "チェンソーマン", "chainsaw", "東京リベンジャーズ", "tokyo revengers",
    ];

    for (const keyword of animeKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        tags.push("anime");
        break;
      }
    }

    if (text.includes("pop") && text.includes("up")) tags.push("pop-up");
    if (text.includes("限定") || text.includes("limited")) tags.push("limited");
    if (text.includes("コラボ") || text.includes("collab")) tags.push("collaboration");
    if (text.includes("グッズ") || text.includes("goods")) tags.push("merchandise");
    if (text.includes("カフェ") || text.includes("cafe")) tags.push("cafe");

    return tags.length > 0 ? tags : ["shopping", "event"];
  }
}
