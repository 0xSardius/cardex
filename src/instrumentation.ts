/**
 * Next.js instrumentation — in-process gacha ingestion pollers.
 *
 * The winners feed (/api/getAllWinners) only serves the latest ~200 pulls —
 * a ~5-6 min window at observed volume — so missed polls are unrecoverable
 * data loss. Railway Cron cadences don't go that low reliably; since the
 * service is always-on anyway, poll in-process:
 *
 *   - pulls: every GACHA_PULLS_POLL_MS (default 150s)
 *   - machines + pool snapshots: every GACHA_POOL_POLL_MS (default 30 min)
 *
 * The /api/cron/ingest-gacha* routes remain as manual/backup triggers.
 * Set GACHA_POLL_DISABLED=1 to turn the pollers off (e.g. local dev against
 * the prod DB). Overlap-guarded; ON CONFLICT dedupe makes accidental
 * double-polling harmless anyway.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;
  if (process.env.GACHA_POLL_DISABLED === "1") {
    console.log("[gacha-poll] disabled via GACHA_POLL_DISABLED");
    return;
  }

  const pullsEvery = parseInt(process.env.GACHA_PULLS_POLL_MS ?? "150000", 10);
  const poolEvery = parseInt(process.env.GACHA_POOL_POLL_MS ?? "1800000", 10);

  const { neon } = await import("@neondatabase/serverless");
  const { GachaClient } = await import("./lib/ingestion/clients/gacha-client");
  const { ingestGachaPulls, ingestGachaMachines, ingestGachaPool } = await import(
    "./lib/ingestion/gacha"
  );

  const sql = neon(process.env.DATABASE_URL);
  const client = new GachaClient();

  let pullsBusy = false;
  setInterval(async () => {
    if (pullsBusy) return;
    pullsBusy = true;
    try {
      const r = await ingestGachaPulls(sql, client);
      if (r.pullsInserted > 0) {
        console.log(`[gacha-poll] pulls +${r.pullsInserted} (${r.pullsObserved} observed)`);
      }
    } catch (err) {
      console.error("[gacha-poll] pulls failed:", err instanceof Error ? err.message : err);
    } finally {
      pullsBusy = false;
    }
  }, pullsEvery);

  let poolBusy = false;
  const poolTick = async () => {
    if (poolBusy) return;
    poolBusy = true;
    try {
      const m = await ingestGachaMachines(sql, client);
      const p = await ingestGachaPool(sql, client);
      console.log(
        `[gacha-poll] machines ${m.snapshotsInserted} snapshots; pool ${p.rowsUpserted} rows, +${p.mintsResolved} resolved`
      );
    } catch (err) {
      console.error("[gacha-poll] pool failed:", err instanceof Error ? err.message : err);
    } finally {
      poolBusy = false;
    }
  };
  setInterval(poolTick, poolEvery);
  // Prime machines/pool shortly after boot so a fresh deploy has data.
  setTimeout(poolTick, 15_000);

  console.log(
    `[gacha-poll] started — pulls every ${Math.round(pullsEvery / 1000)}s, pool every ${Math.round(poolEvery / 60000)}min`
  );
}
