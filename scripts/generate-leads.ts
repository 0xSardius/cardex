/**
 * Generate the Lane-A demand-test asset: real, verifiable "tokenized Pokémon
 * listed below value" leads. To survive the per-card noise we proved, we
 * TRIANGULATE — only surface listings below the CONSERVATIVE floor of two
 * independent value sources (CC insured value AND our paper-market price), and
 * only when the two sources roughly agree. Under-promises by design.
 *
 * Writes leads-report.html (shareable) + prints the top leads.
 * Read-only. Usage: npx tsx scripts/generate-leads.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { getSolUsdRate } from "../src/lib/oracle/sol-usd";
import { gradedConditionFor, fetchPaperPrice } from "../src/lib/pricing/paper-price";
import { writeFileSync } from "node:fs";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const solUsd = (await getSolUsdRate())?.rate ?? null;

  const rows = (await sql`
    SELECT DISTINCT ON (l.mint_address)
      l.mint_address, c.id AS collectible_id, c.name, s.name AS set_name,
      mcm.grader, mcm.grade, l.price_sol, l.price_usdc, l.price_usd,
      (SELECT a.value->>'value' FROM jsonb_array_elements(mcm.raw_attributes) a
       WHERE lower(a.value->>'trait_type') = 'insured value' LIMIT 1) AS insured
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE l.expired_at IS NULL AND mcm.collectible_id IS NOT NULL
    ORDER BY l.mint_address, l.price_sol::numeric ASC NULLS LAST
  `) as any[];

  const leads: any[] = [];
  for (const r of rows) {
    const ask = r.price_usdc ? +r.price_usdc : r.price_usd ? +r.price_usd : r.price_sol && solUsd ? +r.price_sol * solUsd : null;
    const insured = r.insured && r.insured !== "NA" ? parseFloat(r.insured) : null;
    if (ask == null || ask < 10) continue;

    const cond = gradedConditionFor({ grader: r.grader, grade: r.grade });
    const pp = await fetchPaperPrice(sql, r.collectible_id, cond);
    const paper = pp.median_usd;

    // Need BOTH independent sources to triangulate.
    if (!insured || insured < 25 || !paper) continue;
    // Sources must roughly agree (within 3x) — else one is an artifact.
    const hi = Math.max(insured, paper), lo = Math.min(insured, paper);
    if (hi / lo > 3) continue;
    const floor = lo; // conservative: the lower of the two independent estimates
    if (ask >= floor * 0.8) continue; // require ≥20% below the conservative floor

    leads.push({
      card: r.name, set: r.set_name, grade: r.grader && r.grade ? `${r.grader} ${r.grade}` : "raw",
      ask: Math.round(ask), insured: Math.round(insured), paper: Math.round(paper),
      floor: Math.round(floor), disc: Math.round((1 - ask / floor) * 100),
      basis: pp.condition_basis,
      url: `https://magiceden.us/item-details/${r.mint_address}`,
    });
  }
  leads.sort((a, b) => b.disc - a.disc);

  console.log(`Triangulated leads (below conservative floor of insured + paper, sources agree): ${leads.length}\n`);
  console.table(leads.slice(0, 20).map(({ url, ...x }) => x));

  // Shareable HTML
  const rowsHtml = leads.slice(0, 30).map((l) => `
    <tr><td><a href="${l.url}" target="_blank">${l.card}</a><div class="set">${l.set ?? ""} · ${l.grade}</div></td>
    <td class="n">$${l.ask}</td><td class="n">$${l.insured}</td><td class="n">$${l.paper}<div class="set">${l.basis}</div></td>
    <td class="d">−${l.disc}%</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>CardEx — Tokenized Pokémon Mispricing Leads</title>
<style>body{background:#0b0e14;color:#e6edf3;font:15px/1.5 -apple-system,Segoe UI,sans-serif;max-width:760px;margin:0 auto;padding:40px 20px}
h1{font-size:24px;margin:0 0 4px}.sub{color:#9aa7b8;font-size:13px;margin:0 0 8px}.note{color:#6b7787;font-size:12px;margin:0 0 24px;border-left:2px solid #273142;padding-left:12px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #1b2230}
th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7787}.n{text-align:right;font-variant-numeric:tabular-nums;color:#9aa7b8}
.d{text-align:right;font-weight:700;color:#3fb950}a{color:#58a6ff;text-decoration:none}.set{color:#6b7787;font-size:11px}</style></head>
<body><h1>Tokenized Pokémon — listed below value</h1>
<p class="sub">Live Magic Eden / Collector Crypt listings · ${new Date().toISOString().slice(0,10)} · ${leads.length} leads</p>
<p class="note">Each card is listed below the conservative floor of TWO independent value sources (Collector Crypt's insured value + paper-market price), and only shown when those sources agree within 3×. These are <b>leads to verify</b>, not guarantees — graded-card prices are noisy. Click a card to check it live on Magic Eden.</p>
<table><tr><th>Card</th><th class="n">Listed</th><th class="n">Insured</th><th class="n">Paper</th><th class="d">Below floor</th></tr>${rowsHtml}</table></body></html>`;
  writeFileSync("leads-report.html", html);
  console.log(`\nWrote leads-report.html (${Math.min(leads.length, 30)} leads)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
