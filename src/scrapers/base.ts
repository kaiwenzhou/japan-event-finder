export interface ScrapedEvent {
  id: string;
  title_ja: string;
  title_en: string | null;
  description_ja: string | null;
  description_en: string | null;
  date_start: string;
  date_end: string | null;
  venue_name: string;
  venue_address: string | null;
  area: string;
  category: string;
  tags: string[];
  price_min: number | null;
  price_max: number | null;
  source_url: string;
  source_name: string;
  image_url: string | null;
}

export interface ScraperResult {
  source: string;
  events: ScrapedEvent[];
  errors: string[];
  duration_ms: number;
}

export abstract class BaseScraper {
  abstract name: string;
  abstract baseUrl: string;

  protected async fetch(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  protected generateId(prefix: string, unique: string): string {
    // Create a simple hash for consistent IDs
    const hash = unique
      .split("")
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
    return `${prefix}-${Math.abs(hash).toString(36)}`;
  }

  protected parseDate(dateStr: string): string | null {
    try {
      // Try various date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  protected parsePrice(priceStr: string): number | null {
    const match = priceStr.replace(/,/g, "").match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  protected detectArea(text: string): string {
    const areaPatterns: [RegExp, string][] = [
      [/東京|tokyo|渋谷|新宿|池袋|銀座|六本木|秋葉原|上野|浅草/i, "Tokyo"],
      [/大阪|osaka|梅田|難波|心斎橋/i, "Osaka"],
      [/京都|kyoto/i, "Kyoto"],
      [/横浜|yokohama/i, "Yokohama"],
      [/名古屋|nagoya/i, "Nagoya"],
      [/福岡|fukuoka|博多/i, "Fukuoka"],
      [/札幌|sapporo/i, "Sapporo"],
      [/神戸|kobe/i, "Kobe"],
      [/広島|hiroshima/i, "Hiroshima"],
      [/仙台|sendai/i, "Sendai"],
    ];

    for (const [pattern, area] of areaPatterns) {
      if (pattern.test(text)) {
        return area;
      }
    }
    return "Japan";
  }

  protected detectCategory(text: string): string {
    const categoryPatterns: [RegExp, string][] = [
      [/歌舞伎|kabuki/i, "kabuki"],
      [/落語|rakugo/i, "rakugo"],
      [/オーケストラ|orchestra|交響楽|symphony|クラシック|classical/i, "orchestra"],
      [/ミュージカル|musical|broadway/i, "musical"],
      [/アニメ|anime|manga|漫画|コラボ|collab/i, "anime"],
      [/コンサート|concert|ライブ|live|音楽|music/i, "concert"],
      [/演劇|theatre|theater|舞台|stage/i, "theatre"],
      [/祭り|festival|まつり|matsuri/i, "festival"],
      [/展示|exhibition|展覧|美術|art|museum/i, "art"],
      [/映画|film|movie|cinema/i, "film"],
    ];

    for (const [pattern, category] of categoryPatterns) {
      if (pattern.test(text)) {
        return category;
      }
    }
    return "event";
  }

  abstract scrape(): Promise<ScrapedEvent[]>;

  async run(): Promise<ScraperResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let events: ScrapedEvent[] = [];

    try {
      events = await this.scrape();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      source: this.name,
      events,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }
}
