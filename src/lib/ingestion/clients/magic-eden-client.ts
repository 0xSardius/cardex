/**
 * MagicEdenClient — thin interface over Magic Eden's Solana REST API.
 *
 * v2 has a deprecation notice ("winding down support for certain APIs").
 * Wrapping behind an interface so we can swap to v4 or direct M2 indexing
 * via Helius webhook without touching adapter code. See docs/RWA-RECON.md §3.
 *
 * Rate limit: 120 QPM / 2 QPS public. Implementation enforces 2 QPS internally.
 */

const ME_BASE = "https://api-mainnet.magiceden.dev/v2";
const DEFAULT_QPS = 2;

export interface MagicEdenListing {
  pdaAddress: string;
  auctionHouse?: string;
  tokenMint: string;
  seller: string;
  sellerReferral?: string;
  tokenSize: number;
  price: number; // SOL equivalent (ME-computed if listing is SPL-denominated)
  priceInfo?: {
    solPrice?: {
      rawAmount: string;
      address: string;
      decimals: number;
    };
    splPrice?: {
      rawAmount: string;
      address: string;
      decimals: number;
      symbol?: string;
    };
  };
  expiry: number; // -1 = no expiration, else unix timestamp seconds
  listStatus: string;
  listingSource?: string; // "M2" | "MMM" | etc
  extra?: {
    img?: string;
  };
}

export interface MagicEdenToken {
  mintAddress: string;
  name?: string;
  collection?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  image?: string;
  updateAuthority?: string;
  sellerFeeBasisPoints?: number;
  primarySaleHappened?: boolean;
  isMutable?: boolean;
  owner?: string;
}

export interface MagicEdenClient {
  /**
   * Page through active listings for a collection symbol.
   * Loops until ME returns an empty array.
   *
   * `attributeFilter`: Magic Eden's nested attributes filter (AND-of-ORs).
   *   e.g., [[{ traitType: "Category", value: "Pokemon" }]]
   */
  getCollectionListings(
    symbol: string,
    options?: {
      limit?: number;
      maxPages?: number;
      attributeFilter?: Array<Array<{ traitType: string; value: string }>>;
      signal?: AbortSignal;
    }
  ): AsyncGenerator<MagicEdenListing[]>;

  /**
   * Fetch metadata + attributes for a single mint. Used for mint→identity resolution.
   * Returns null on 404.
   */
  getToken(mint: string): Promise<MagicEdenToken | null>;
}

export interface MagicEdenV2ClientOptions {
  baseUrl?: string;
  qps?: number;
  userAgent?: string;
}

/**
 * v2 REST implementation. Single-instance throttling via internal rate limiter.
 */
export class MagicEdenV2Client implements MagicEdenClient {
  private readonly base: string;
  private readonly minIntervalMs: number;
  private readonly userAgent: string;
  private lastRequestAt = 0;

  constructor(options: MagicEdenV2ClientOptions = {}) {
    this.base = options.baseUrl ?? ME_BASE;
    this.minIntervalMs = 1000 / (options.qps ?? DEFAULT_QPS);
    this.userAgent =
      options.userAgent ?? "CardEx/0.1 (https://github.com/0xSardius/cardex)";
  }

  async *getCollectionListings(
    symbol: string,
    options: {
      limit?: number;
      maxPages?: number;
      attributeFilter?: Array<Array<{ traitType: string; value: string }>>;
      signal?: AbortSignal;
    } = {}
  ): AsyncGenerator<MagicEdenListing[]> {
    const limit = Math.min(options.limit ?? 100, 100);
    const maxPages = options.maxPages ?? Infinity;
    let offset = 0;
    let pages = 0;

    const attributesParam = options.attributeFilter
      ? `&attributes=${encodeURIComponent(JSON.stringify(options.attributeFilter))}`
      : "";

    while (pages < maxPages) {
      const url = `${this.base}/collections/${encodeURIComponent(symbol)}/listings?offset=${offset}&limit=${limit}${attributesParam}`;
      const batch = await this.fetchJson<MagicEdenListing[]>(url, options.signal);
      if (!Array.isArray(batch) || batch.length === 0) return;
      yield batch;
      pages++;
      offset += batch.length;
      if (batch.length < limit) return;
    }
  }

  async getToken(mint: string): Promise<MagicEdenToken | null> {
    const url = `${this.base}/tokens/${encodeURIComponent(mint)}`;
    try {
      return await this.fetchJson<MagicEdenToken>(url);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  private async fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    await this.throttle();

    for (let attempt = 0; attempt < 4; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { "User-Agent": this.userAgent, Accept: "application/json" },
          signal,
        });
      } catch (err) {
        if (attempt === 3) throw err;
        await sleep(1000 * (attempt + 1));
        continue;
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") ?? "60");
        await sleep(retryAfter * 1000);
        continue;
      }
      if (res.status === 404) {
        const err: any = new Error(`Magic Eden 404 for ${url}`);
        err.status = 404;
        throw err;
      }
      if (!res.ok) {
        if (attempt === 3) {
          throw new Error(`Magic Eden ${res.status} ${res.statusText} for ${url}`);
        }
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return (await res.json()) as T;
    }
    throw new Error(`Magic Eden retries exhausted for ${url}`);
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const wait = this.lastRequestAt + this.minIntervalMs - now;
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
