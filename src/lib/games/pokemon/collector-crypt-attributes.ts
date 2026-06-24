/**
 * Collector Crypt attribute parser.
 *
 * Collector Crypt encodes physical card identity in the offchain JSON
 * attributes array (returned by Magic Eden's /v2/tokens/{mint} or Helius
 * getAsset). See docs/RWA-RECON.md §1.4 for sampled schema.
 *
 * This module is a pure parser — DB lookups happen in the adapter.
 */

export interface ParsedCardIdentity {
  category: string; // "Pokemon" | "Sports" | "Moonbirds" | etc — adapter filters non-Pokemon
  cardName: string | null;
  serialNumber: string | null; // collectibles.set_number
  setRaw: string | null; // "Pokémon Card 151 - sv2a - Japanese"
  setCode: string | null; // "sv2a" — extracted, may be null if not present
  setName: string | null; // "Pokémon Card 151" — pre-code portion of setRaw
  language: string; // "en" | "ja" | "de" | ... — defaults "en"
  year: number | null;
  grader: string | null; // "PSA" | "CGC" | "BGS" | "SGC" — uppercase
  grade: number | null; // 9.5, 10.0
  parallel: string | null; // "Super Rare Holo" — trait_type "Parallel"
}

interface MetaAttribute {
  trait_type: string;
  value: string | number;
}

const LANGUAGE_MAP: Record<string, string> = {
  english: "en",
  japanese: "ja",
  german: "de",
  french: "fr",
  italian: "it",
  spanish: "es",
  korean: "ko",
  chinese: "zh",
  portuguese: "pt",
};

const SET_CODE_PATTERN = /^[a-z][a-z0-9]{1,9}$/;

export function parseCollectorCryptAttributes(
  attributes: MetaAttribute[] | undefined | null
): ParsedCardIdentity | null {
  if (!attributes || attributes.length === 0) return null;

  const lookup = new Map<string, string>();
  for (const attr of attributes) {
    if (attr.trait_type && attr.value != null) {
      lookup.set(attr.trait_type.toLowerCase(), String(attr.value));
    }
  }

  const category = lookup.get("category");
  if (!category) return null;

  const cardName = lookup.get("card name") ?? null;
  const serialNumber = lookup.get("serial number") ?? null;
  const setRaw = lookup.get("set") ?? null;
  const yearStr = lookup.get("year");
  const year = yearStr ? parseInt(yearStr) : null;
  const graderRaw = lookup.get("grading company");
  const grader = graderRaw ? graderRaw.toUpperCase() : null;
  const gradeRaw = lookup.get("the grade");
  const grade = gradeRaw ? parseGrade(gradeRaw) : null;
  const parallel = lookup.get("parallel") ?? null;

  const { setCode, setName, language } = parseSetString(setRaw);

  return {
    category,
    cardName,
    serialNumber,
    setRaw,
    setCode,
    setName,
    language,
    year: Number.isFinite(year as number) ? (year as number) : null,
    grader,
    grade,
    parallel,
  };
}

/**
 * Extract grade value from strings like "GEM MINT 9.5", "MINT 9", "PRISTINE 10".
 * Returns the last numeric token in the string.
 */
function parseGrade(raw: string): number | null {
  const match = raw.match(/(\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n;
}

/**
 * Parse Collector Crypt's "Set" attribute string into components.
 *
 * CC set formats observed in production:
 *   "Pokémon Card 151 - sv2a - Japanese"   — embedded code + language
 *   "Brilliant Stars - English"            — clean name + language
 *   "Pokemon XY Steam Siege"               — CC-prefixed, no separators
 *   "World Championship Decks - English"   — multi-word name + language
 *
 * Returns nulls when fields can't be confidently extracted.
 */
function parseSetString(raw: string | null): {
  setCode: string | null;
  setName: string | null;
  language: string;
} {
  if (!raw) return { setCode: null, setName: null, language: "en" };

  const parts = raw
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);

  let setCode: string | null = null;
  let language: string = "en";
  const nonCodeParts: string[] = [];

  for (const part of parts) {
    const partLower = part.toLowerCase();
    if (LANGUAGE_MAP[partLower]) {
      language = LANGUAGE_MAP[partLower];
      continue;
    }
    if (SET_CODE_PATTERN.test(part) && !setCode) {
      setCode = part;
      continue;
    }
    nonCodeParts.push(part);
  }

  // Catch a language embedded mid-string rather than as a clean " - " part,
  // e.g. "Pokemon Japanese SV3-Ruler of the Black Flame" or "Pokemon German".
  // Only override the default — explicit "- English" parts already set 'en'.
  if (language === "en") {
    const lower = raw.toLowerCase();
    for (const [word, code] of Object.entries(LANGUAGE_MAP)) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) {
        language = code;
        break;
      }
    }
  }

  const setName = nonCodeParts.length > 0
    ? normalizeSetName(nonCodeParts.join(" - "))
    : null;
  return { setCode, setName, language };
}

/**
 * Strip leading "Pokemon"/"Pokémon" + era marker from CC set names so they
 * match our `sets.name` values (which are pokemontcg.io canonical names).
 * Examples:
 *   "Pokemon XY Steam Siege"     → "Steam Siege"
 *   "Pokémon Card 151"           → "151" (won't match; expected — Japanese sets use code path)
 *   "Brilliant Stars"            → "Brilliant Stars" (unchanged)
 */
function normalizeSetName(name: string): string {
  return name
    .replace(/^pok[eé]mon\s+/i, "")
    .replace(/^(xy|sv|sm|swsh|sword\s*&?\s*shield|black\s*&?\s*white|bw|hgss)\s+/i, "")
    .trim();
}

/**
 * Normalize a Collector Crypt serial into our catalog's card-number format.
 *   - Strip trailing total:        "19/146" → "19"
 *   - Strip leading zeros:         "059"    → "59"   (catalog stores bare numbers;
 *                                                     CC zero-pads them)
 *   - Strip zeros after an alpha prefix: "SV016" → "SV16", "TG01" → "TG1"
 *     (subset codes are stored un-padded in pokemontcg.io)
 * Pure-numeric and alphanumeric subset numbers are both handled; a lone "0"
 * (no following digit) is preserved.
 */
export function normalizeCardNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const idx = raw.indexOf("/");
  let out = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  // Pure leading zeros before a digit: "059" → "59".
  out = out.replace(/^0+(?=\d)/, "");
  // Zeros padding a digit run after an alpha prefix: "SV016" → "SV16".
  out = out.replace(/^([A-Za-z]+)0+(?=\d)/, "$1");
  return out.length > 0 ? out : null;
}
