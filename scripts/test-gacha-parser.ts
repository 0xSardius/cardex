import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { parseGachaTitle } from "../src/lib/games/pokemon/gacha-title-parser";
import { normalizeCardNumber } from "../src/lib/games/pokemon/collector-crypt-attributes";
import { buildResolutionContext } from "../src/lib/ingestion/magic-eden";

const SAMPLES = [
  "2022 Pokemon Sword & Shield Lost Origin CHR Pikachu #TG05 CGC 9 MINT",
  "2024 #232 Mew EX PSA 10 Paf EN-Paldean Fates",
  "2023 #205 Mew EX PSA 9 151 Ultra-Premium Collection",
  "2022 #075 Special Delivery Charizard-Holo PSA 10 Swsh Black Star Promo",
  "2001 #41 Lucky Stadium-N.Y. Center PSA 9 Promo Black Star Pokemon",
  "2019 #191 Full Art/Eevee & Snorlax GX PSA 10 Sun & Moon Team Up",
  "2000 Pokemon Gym Challenge Holo Koga #19 CGC 8.5 NM-MT+",
];

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const ctx = await buildResolutionContext(sql);
  for (const s of SAMPLES) {
    const p = parseGachaTitle(s)!;
    console.log(`\n"${s}"`);
    console.log(
      `  #${p.cardNumber} → ${normalizeCardNumber(p.cardNumber)} | name="${p.cardName}" | abbrev=${p.setAbbrev} | setName="${p.setName}" | blob="${p.setCardBlob}" | lang=${p.language}`
    );
    // Check catalog key existence for likely candidates
    for (const probe of ["swsh11tg|tg05", "swsh11tg|tg5", "sv3pt5|205", "swshp|swsh075", "basep|41", "sm9|191"]) {
      if (ctx.collectibleByKey.has(probe)) console.log(`  catalog HAS ${probe}`);
    }
    break; // key probes only needed once
  }
  for (const s of SAMPLES) {
    const p = parseGachaTitle(s)!;
    console.log(
      `${(p.setAbbrev ?? p.setName ?? p.setCardBlob ?? "??").padEnd(45)} | #${String(p.cardNumber).padEnd(8)} | lang=${p.language} | "${s.slice(0, 60)}"`
    );
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
