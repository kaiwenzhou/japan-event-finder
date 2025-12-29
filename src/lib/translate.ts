/**
 * Translation utilities for Japanese to English
 *
 * Supports:
 * - DeepL API (recommended, requires API key)
 * - Google Cloud Translation API (requires API key)
 * - Fallback: Basic transliteration for common terms
 */

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

interface TranslationResult {
  original: string;
  translated: string;
  provider: "deepl" | "google" | "cache" | "fallback";
}

// Simple in-memory cache for translations
const translationCache = new Map<string, string>();

// Common Japanese terms that appear in event titles
const commonTerms: Record<string, string> = {
  公演: "Performance",
  演奏会: "Concert",
  交響楽団: "Symphony Orchestra",
  定期演奏会: "Regular Concert",
  歌舞伎: "Kabuki",
  落語: "Rakugo",
  新春: "New Year",
  初春: "Early Spring",
  大歌舞伎: "Grand Kabuki",
  座: "Theater",
  劇場: "Theater",
  ホール: "Hall",
  美術館: "Museum",
  展覧会: "Exhibition",
  展示: "Exhibition",
  コンサート: "Concert",
  ライブ: "Live",
  フェスティバル: "Festival",
  祭り: "Festival",
  まつり: "Festival",
};

export async function translateJapaneseToEnglish(text: string): Promise<TranslationResult> {
  if (!text || text.trim().length === 0) {
    return { original: text, translated: text, provider: "fallback" };
  }

  // Check cache first
  const cached = translationCache.get(text);
  if (cached) {
    return { original: text, translated: cached, provider: "cache" };
  }

  // Try DeepL first (best quality for Japanese)
  if (DEEPL_API_KEY) {
    try {
      const result = await translateWithDeepL(text);
      translationCache.set(text, result);
      return { original: text, translated: result, provider: "deepl" };
    } catch (error) {
      console.error("DeepL translation failed:", error);
    }
  }

  // Try Google Translate
  if (GOOGLE_TRANSLATE_API_KEY) {
    try {
      const result = await translateWithGoogle(text);
      translationCache.set(text, result);
      return { original: text, translated: result, provider: "google" };
    } catch (error) {
      console.error("Google translation failed:", error);
    }
  }

  // Fallback: Basic term replacement
  const result = basicTranslate(text);
  return { original: text, translated: result, provider: "fallback" };
}

async function translateWithDeepL(text: string): Promise<string> {
  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      source_lang: "JA",
      target_lang: "EN",
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const data = await response.json();
  return data.translations[0].text;
}

async function translateWithGoogle(text: string): Promise<string> {
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: text,
        source: "ja",
        target: "en",
        format: "text",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google Translate API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

function basicTranslate(text: string): string {
  let result = text;

  // Replace known terms
  for (const [jp, en] of Object.entries(commonTerms)) {
    result = result.replace(new RegExp(jp, "g"), en);
  }

  return result;
}

// Batch translate multiple texts
export async function translateBatch(
  texts: string[]
): Promise<Map<string, TranslationResult>> {
  const results = new Map<string, TranslationResult>();

  for (const text of texts) {
    const result = await translateJapaneseToEnglish(text);
    results.set(text, result);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

// Translate events that don't have English titles
export async function translateEventTitles(
  events: { id: string; title_ja: string; title_en: string | null }[]
): Promise<Map<string, string>> {
  const translations = new Map<string, string>();

  const toTranslate = events.filter((e) => e.title_ja && !e.title_en);

  console.log(`Translating ${toTranslate.length} event titles...`);

  for (const event of toTranslate) {
    try {
      const result = await translateJapaneseToEnglish(event.title_ja);
      translations.set(event.id, result.translated);
    } catch (error) {
      console.error(`Failed to translate event ${event.id}:`, error);
    }
  }

  return translations;
}
