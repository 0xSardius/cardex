/**
 * Collector Crypt Gacha API client.
 *
 * Read endpoints are public (no x-api-key) — verified live 2026-07-19, see
 * docs/jupiter-gacha/05-api-recon.md. The same backend serves Jupiter Gacha
 * (memo_slug "jupiter") and any other white-label frontend.
 *
 * Caps observed live:
 *   - getNfts: top 100 per (code, rarity) by insured value, no pagination
 *   - getAllWinners: `count` param, hard cap 200, latest-only (no backfill)
 */

const DEFAULT_BASE_URL = "https://gacha.collectorcrypt.com";

export interface GachaMachine {
  code: string;
  name: string;
  price: number;
  contains: number;
  instantBuyback: number; // percent of insured value paid on buyback
  public: boolean;
  odds: Record<string, number>; // { common, uncommon, rare, epic }
  tierRanges: Record<string, { start: number; end: number }>;
  stock: Record<string, number>;
  ev: number; // platform's rarity-weighted expected INSURED value
  targetEv: number;
  [key: string]: unknown;
}

export interface GachaNft {
  nft_address: string;
  name: string;
  description: string;
  rarity: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  image: string;
  insured_value: number;
  [key: string]: unknown;
}

export interface GachaWinner {
  winner: string;
  nft_address: string;
  insuredValue: number;
  created_at: string;
  memo_slug: string;
  pack_type: string;
  prize_tier: number; // 1=epic 2=rare 3=uncommon 4=common
  nft?: {
    content?: {
      metadata?: {
        name?: string;
        json_name?: string;
        attributes?: Array<{ trait_type: string; value: string | number }>;
      };
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class GachaClient {
  constructor(private baseUrl: string = process.env.GACHA_API_URL ?? DEFAULT_BASE_URL) {}

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Gacha API ${res.status} for ${path}`);
    }
    throw new Error(`Gacha API failed after retries for ${path}`);
  }

  async getMachines(): Promise<GachaMachine[]> {
    const data = await this.get<{ machines: GachaMachine[] }>("/api/machines");
    return data.machines ?? [];
  }

  async getStock(): Promise<Record<string, Record<string, number>>> {
    return this.get("/api/stock");
  }

  /** Top 100 NFTs by insured value for one (machine, rarity). */
  async getNfts(code: string, rarity: string): Promise<GachaNft[]> {
    const data = await this.get<{ nfts: GachaNft[] }>(
      `/api/getNfts?code=${encodeURIComponent(code)}&rarity=${encodeURIComponent(rarity)}`
    );
    return data.nfts ?? [];
  }

  /** Latest pulls, newest first. count caps at 200 server-side. */
  async getAllWinners(opts: { count?: number; packType?: string; slug?: string } = {}): Promise<GachaWinner[]> {
    const params = new URLSearchParams();
    params.set("count", String(opts.count ?? 200));
    if (opts.packType) params.set("packType", opts.packType);
    if (opts.slug) params.set("slug", opts.slug);
    const data = await this.get<{ success: boolean; data: GachaWinner[] }>(
      `/api/getAllWinners?${params.toString()}`
    );
    return data.data ?? [];
  }
}
