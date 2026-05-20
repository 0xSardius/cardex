/**
 * SOL/USD oracle via Pyth Hermes HTTP API.
 *
 * Used to convert SOL-denominated marketplace listings into USD-equivalent
 * asks for spread calculation. Without this, every Collector Crypt listing
 * (most are SOL-denominated) is opaque to rwa-fair-value and rwa-arbitrage.
 *
 * 60s in-process cache — Pyth publishes updates ~400ms but burning a
 * Hermes call per API request is overkill at our scale.
 *
 * Returns null on network failure so callers can degrade to a
 * `best_ask_currency: "SOL_only"` response instead of failing the request.
 */

const HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";
const SOL_USD_FEED_ID =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const CACHE_TTL_MS = 60_000;

export interface SolUsdRate {
  /** USD per 1 SOL, e.g. 85.97 */
  rate: number;
  /** Pyth confidence interval in USD (±). */
  confidence_usd: number;
  /** Pyth publish_time (seconds since epoch). */
  publish_time: Date;
  /** Age of the price at the time the caller observed it. */
  age_ms: number;
  /** "pyth-hermes" for now; could be "jupiter" or fallback later. */
  source: "pyth-hermes";
}

interface CachedRate {
  rate: SolUsdRate;
  fetched_at: number;
}

let cached: CachedRate | null = null;

interface HermesParsed {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

interface HermesResponse {
  parsed?: HermesParsed[];
}

export async function getSolUsdRate(): Promise<SolUsdRate | null> {
  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    return {
      ...cached.rate,
      age_ms: Date.now() - cached.rate.publish_time.getTime(),
    };
  }

  try {
    const url = `${HERMES_URL}?ids[]=${SOL_USD_FEED_ID}&parsed=true`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CardEx/0.1",
      },
    });
    if (!res.ok) {
      console.error(`[sol-usd] hermes ${res.status} ${res.statusText}`);
      return null;
    }
    const json = (await res.json()) as HermesResponse;
    const parsed = json.parsed?.[0];
    if (!parsed?.price) {
      console.error("[sol-usd] hermes returned no parsed price");
      return null;
    }
    const priceRaw = BigInt(parsed.price.price);
    const confRaw = BigInt(parsed.price.conf);
    const expo = parsed.price.expo; // typically -8
    const scale = Math.pow(10, -expo);
    const rate = Number(priceRaw) / scale;
    const confidence_usd = Number(confRaw) / scale;
    const publish_time = new Date(parsed.price.publish_time * 1000);

    const result: SolUsdRate = {
      rate,
      confidence_usd,
      publish_time,
      age_ms: Date.now() - publish_time.getTime(),
      source: "pyth-hermes",
    };

    cached = { rate: result, fetched_at: Date.now() };
    return result;
  } catch (err) {
    console.error("[sol-usd] hermes fetch failed:", err);
    return null;
  }
}

/**
 * Convenience: convert a SOL price to USD using the cached oracle.
 * Returns null if the oracle is unavailable.
 */
export async function convertSolToUsd(priceSol: number): Promise<number | null> {
  const rate = await getSolUsdRate();
  if (!rate) return null;
  return priceSol * rate.rate;
}
