/**
 * Parser for Collector Crypt NFT title/description strings, as returned by
 * the Gacha API (`getNfts[].description`, winners `nft…json_name`) and by
 * the token `name` field on CC-vaulted mints generally.
 *
 * Two grammars observed live (2026-07-19):
 *
 * Grammar 1 — CC-native: `{year} #{number} {cardName} {GRADER} {grade} {setPart}`
 *   "1999 #6 Charizard-Holo PSA 10 Japanese CD Promo"
 *   "2024 #232 Mew EX PSA 10 Paf EN-Paldean Fates"
 *   "2026 #042 Piplup CGC 10 Pristine Black Star Promos - Mega Evolution MEP EN - English"
 *   setPart shapes: "{Abbrev} {LANG}-{Set Name}", "{Set Name} {Abbrev} EN[ - English]",
 *   or a bare label ("Game", "Japanese CD Promo"). May be prefixed with grade
 *   qualifiers ("Pristine", "GEM MINT") that belong to the grade, not the set.
 *
 * Grammar 2 — PSA-label style: `{year} Pokemon {set+card blob} #{number} {GRADER} {grade} [{label}]`
 *   "2000 Pokemon Gym Challenge Holo Koga #19 CGC 8.5 NM-MT+"
 *   "2019 Pokemon Sun & Moon Hidden Fates Reverse Holo Charmander #7 CGC 10 GEM MINT"
 *   Set and card name are mixed in the blob — catalog set is found by
 *   substring-scanning known set names (adapter's job; parser exposes the blob).
 *
 * Pure parser — no DB access. Catalog matching happens in the adapter.
 */

export interface ParsedGachaTitle {
  year: number | null;
  cardNumber: string | null; // un-normalized ("080") — run through normalizeCardNumber
  cardName: string | null;
  grader: string | null; // "PSA" | "CGC" | "BGS" | ...
  grade: number | null;
  language: string; // ISO-ish code, defaults "en"
  setName: string | null; // best-effort set name (grammar 1)
  setAbbrev: string | null; // "Paf" | "Svp" | "Mep" — often the pokemontcg.io set code
  setCardBlob: string | null; // grammar 2: set+card mixed — substring-scan against known sets
  setPartRaw: string | null; // everything after the grade (grammar 1), for debugging
}

const GRADERS = "PSA|CGC|BGS|SGC|TAG|ACE|AGS|GMA";
const GRADER_PATTERN = new RegExp(`\\b(${GRADERS})\\s+(\\d+(?:\\.\\d+)?)\\b`);
const GRAMMAR2_PATTERN = new RegExp(
  `^(\\d{4})\\s+Pok[eé]mon\\s+(.+?)\\s+#(\\S+)\\s+(${GRADERS})\\s+(\\d+(?:\\.\\d+)?)\\b`,
  "i"
);

const LANGUAGE_WORDS: Record<string, string> = {
  english: "en",
  japanese: "ja",
  german: "de",
  french: "fr",
  italian: "it",
  spanish: "es",
  korean: "ko",
  chinese: "zh",
  portuguese: "pt",
  indonesian: "id",
  thai: "th",
};

// Grade qualifiers that trail "{GRADER} {grade}" and must not pollute the set name.
const GRADE_QUALIFIER_PREFIX =
  /^(pristine|gem[ -]?mint|gem-mt|mint|nm-mt\+?|nm\/mt|near mint|excellent|ex-mt|vg-ex|perfect)\s+/i;

// PSA-label set names that differ from pokemontcg.io canonical names.
const SET_NAME_ALIASES: Record<string, string> = {
  game: "base", // 1999 "Pokemon Game" = Base Set
  rocket: "team rocket",
};

export function parseGachaTitle(raw: string | null | undefined): ParsedGachaTitle | null {
  if (!raw) return null;
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;

  // Grammar 1: "{year} #{number} …"
  const g1 = text.match(/^(\d{4})\s+#(\S+)\s+(.*)$/);
  if (g1) {
    const year = parseInt(g1[1], 10);
    const cardNumber = g1[2];
    const rest = g1[3];

    let cardName: string | null = null;
    let grader: string | null = null;
    let grade: number | null = null;
    let setPartRaw: string | null = null;

    const gm = rest.match(GRADER_PATTERN);
    if (gm && gm.index != null) {
      cardName = rest.slice(0, gm.index).trim() || null;
      grader = gm[1].toUpperCase();
      grade = parseGradeNumber(gm[2]);
      setPartRaw = rest.slice(gm.index + gm[0].length).trim() || null;
    } else {
      cardName = rest || null;
    }

    const { language, setName, setAbbrev } = parseSetPart(setPartRaw);
    return {
      year,
      cardNumber,
      cardName,
      grader,
      grade,
      language,
      setName,
      setAbbrev,
      setCardBlob: null,
      setPartRaw,
    };
  }

  // Grammar 2: "{year} Pokemon {blob} #{number} {GRADER} {grade}"
  const g2 = text.match(GRAMMAR2_PATTERN);
  if (g2) {
    const blob = g2[2].trim();
    return {
      year: parseInt(g2[1], 10),
      cardNumber: g2[3],
      cardName: blob || null, // set + card mixed; best available display string
      grader: g2[4].toUpperCase(),
      grade: parseGradeNumber(g2[5]),
      language: detectLanguageWord(blob) ?? "en",
      setName: null,
      setAbbrev: null,
      setCardBlob: blob || null,
      setPartRaw: null,
    };
  }

  // Neither grammar — return what little we can (language scan on the whole).
  return {
    year: null,
    cardNumber: null,
    cardName: text,
    grader: null,
    grade: null,
    language: detectLanguageWord(text) ?? "en",
    setName: null,
    setAbbrev: null,
    setCardBlob: null,
    setPartRaw: null,
  };
}

function parseGradeNumber(s: string): number | null {
  const g = parseFloat(s);
  return Number.isFinite(g) && g >= 0 && g <= 10 ? g : null;
}

function detectLanguageWord(s: string): string | null {
  const lower = s.toLowerCase();
  for (const [word, code] of Object.entries(LANGUAGE_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return code;
  }
  return null;
}

function parseSetPart(setPartIn: string | null): {
  language: string;
  setName: string | null;
  setAbbrev: string | null;
} {
  if (!setPartIn) return { language: "en", setName: null, setAbbrev: null };
  let setPart = setPartIn.trim();

  // Strip leading grade qualifiers ("Pristine Black Star Promos…" → "Black Star Promos…").
  for (;;) {
    const stripped = setPart.replace(GRADE_QUALIFIER_PREFIX, "");
    if (stripped === setPart) break;
    setPart = stripped;
  }

  // Language detection BEFORE structural stripping ("Japanese CD Promo").
  let language: string | null = /\bEN\b/.test(setPart) ? "en" : null;
  if (!language) language = detectLanguageWord(setPart);
  language = language ?? "en";

  // Strip a trailing " - {Language}" segment ("… MEP EN - English" → "… MEP EN").
  setPart = setPart
    .replace(
      /\s*-\s*(english|japanese|german|french|italian|spanish|korean|chinese|portuguese|indonesian|thai)\s*$/i,
      ""
    )
    .trim();

  let setName: string | null = null;
  let setAbbrev: string | null = null;

  // Shape A: "{Abbrev} {LANG}-{Set Name}"  e.g. "Paf EN-Paldean Fates"
  const shapeA = setPart.match(/^([A-Za-z0-9]{1,8})\s+EN-(.+)$/);
  // Shape B: "{Set Name} {Abbrev} EN"      e.g. "Black Star Promos - Mega Evolution MEP EN"
  const shapeB = setPart.match(/^(.+?)\s+([A-Za-z0-9]{1,8})\s+EN$/);

  if (shapeA) {
    setAbbrev = shapeA[1];
    setName = shapeA[2].trim() || null;
  } else if (shapeB) {
    setName = shapeB[1].trim() || null;
    setAbbrev = shapeB[2];
  } else {
    // Bare label ("Game", "Japanese CD Promo", "151 Ultra-Premium Collection").
    // No dash-splitting here — intra-word dashes ("Ultra-Premium") make the
    // last-dash heuristic wrong more often than right; the adapter's substring
    // scan finds embedded set names instead.
    setName =
      setPart
        .replace(
          /\b(english|japanese|german|french|italian|spanish|korean|simplified|traditional|chinese|portuguese|indonesian|thai)\b/gi,
          ""
        )
        .replace(/\s+/g, " ")
        .trim() || null;
  }

  if (setName) {
    const alias = SET_NAME_ALIASES[setName.toLowerCase()];
    if (alias) setName = alias;
  }

  return { language, setName, setAbbrev };
}
