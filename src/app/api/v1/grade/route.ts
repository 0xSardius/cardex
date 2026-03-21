/**
 * POST /api/v1/grade — Vision-based card grading estimate
 *
 * x402-gated: $0.01 per request (USDC on Solana)
 *
 * Request body:
 *   {
 *     imageUrl: string,         // URL to card image (front)
 *     name?: string,            // Card name (for price lookup)
 *     game?: "mtg" | "pokemon", // Defaults to "mtg"
 *     set?: string,             // Set code for disambiguation
 *   }
 *
 * Returns: estimated grade, grade probabilities, raw vs graded value, ROI
 */

import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { agentMetaSync } from "@/lib/agent-meta";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "@/lib/db";
import { collectibles, sets, pricePoints } from "@/lib/db/schema";
import { eq, ilike, desc, and } from "drizzle-orm";
import { recordPayment } from "@/lib/x402/payments";

// Standard grading costs (PSA 2024 rates)
const GRADING_COSTS = {
  psa: { economy: 20, regular: 50, express: 100 },
  bgs: { standard: 25, express: 75 },
} as const;

// Grade multipliers — how much more a graded card is worth vs raw (rough averages)
const GRADE_MULTIPLIERS: Record<string, number> = {
  "10": 5.0,
  "9.5": 3.0,
  "9": 2.0,
  "8.5": 1.5,
  "8": 1.3,
  "7": 1.1,
  "6": 0.9,
  "5": 0.7,
};

const GradingResultSchema = z.object({
  centering: z.object({
    score: z.number().min(1).max(10),
    notes: z.string(),
  }),
  corners: z.object({
    score: z.number().min(1).max(10),
    notes: z.string(),
  }),
  edges: z.object({
    score: z.number().min(1).max(10),
    notes: z.string(),
  }),
  surface: z.object({
    score: z.number().min(1).max(10),
    notes: z.string(),
  }),
  estimatedGrade: z.number().min(1).max(10),
  gradeLabel: z.string(),
  confidence: z.number().min(0).max(1),
  overallNotes: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.imageUrl) {
    return NextResponse.json(
      { error: "Missing required field: imageUrl" },
      { status: 400 }
    );
  }

  const game = body.game ?? "mtg";

  recordPayment("/api/v1/grade", "0.01").catch(() => {});

  // Vision analysis with Claude
  let gradingResult;
  try {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: GradingResultSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: new URL(body.imageUrl),
            },
            {
              type: "text",
              text: `You are a professional trading card grader. Analyze this ${game === "mtg" ? "Magic: The Gathering" : "Pokémon TCG"} card image and assess its condition for grading (PSA/BGS scale).

Evaluate these four categories on a 1-10 scale:

1. **Centering** — Is the card well-centered? Check border widths on all sides. 60/40 is acceptable, 55/45 is good, 50/50 is perfect.
2. **Corners** — Are the corners sharp and intact? Look for whitening, bending, or rounding.
3. **Edges** — Are the edges clean? Look for chipping, whitening, or nicks along all four edges.
4. **Surface** — Is the surface clean? Look for scratches, print lines, ink spots, or wear on the face.

Then provide:
- **estimatedGrade**: Your overall PSA grade estimate (1-10, can use 0.5 increments)
- **gradeLabel**: The grade name (e.g., "PSA 9 - Mint", "PSA 10 - Gem Mint", "PSA 8 - NM-MT")
- **confidence**: How confident you are in this estimate (0-1). Lower if image quality is poor or you can't see details clearly.
- **overallNotes**: Brief summary of the card's condition and grading outlook.

Be realistic and conservative — it's better to slightly underestimate than overestimate. Most cards grade PSA 7-9, not PSA 10.`,
            },
          ],
        },
      ],
    });
    gradingResult = object;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Vision analysis failed", detail: err.message },
      { status: 500 }
    );
  }

  // Look up card prices if name provided
  let priceData = null;
  let roiAnalysis = null;

  if (body.name) {
    const conditions = [
      eq(collectibles.game, game),
      ilike(collectibles.name, body.name),
    ];

    if (body.set) {
      const setResult = await db
        .select({ id: sets.id })
        .from(sets)
        .where(and(eq(sets.game, game), eq(sets.code, body.set.toLowerCase())))
        .limit(1);

      if (setResult.length > 0) {
        conditions.push(eq(collectibles.setId, setResult[0].id));
      }
    }

    const [card] = await db
      .select({ id: collectibles.id, name: collectibles.name })
      .from(collectibles)
      .where(and(...conditions))
      .limit(1);

    if (card) {
      const [latestPrice] = await db
        .select({
          priceUsd: pricePoints.priceUsd,
          source: pricePoints.source,
          observedAt: pricePoints.observedAt,
        })
        .from(pricePoints)
        .where(eq(pricePoints.collectibleId, card.id))
        .orderBy(desc(pricePoints.observedAt))
        .limit(1);

      if (latestPrice) {
        const rawValue = parseFloat(latestPrice.priceUsd);
        const grade = gradingResult.estimatedGrade;
        const gradeKey = String(grade >= 9.5 ? "9.5" : Math.floor(grade));
        const multiplier = GRADE_MULTIPLIERS[gradeKey] ?? 1.0;
        const gradedValue = rawValue * multiplier;
        const gradingCost = GRADING_COSTS.psa.economy;
        const profit = gradedValue - rawValue - gradingCost;

        priceData = {
          rawValue,
          source: latestPrice.source,
          observedAt: latestPrice.observedAt,
        };

        roiAnalysis = {
          estimatedGradedValue: Math.round(gradedValue * 100) / 100,
          gradeMultiplier: multiplier,
          gradingCost,
          estimatedProfit: Math.round(profit * 100) / 100,
          roi: Math.round((profit / (rawValue + gradingCost)) * 10000) / 100,
          recommendation: profit > 10 ? "grade" : profit > 0 ? "hold" : "sell_raw",
          recommendationReason:
            profit > 10
              ? `Estimated $${Math.round(profit)} profit after grading costs`
              : profit > 0
                ? "Marginal profit — consider grading only if confident in grade"
                : "Grading cost exceeds expected value increase",
        };
      }
    }
  }

  return NextResponse.json({
    grading: {
      centering: gradingResult.centering,
      corners: gradingResult.corners,
      edges: gradingResult.edges,
      surface: gradingResult.surface,
      estimatedGrade: gradingResult.estimatedGrade,
      gradeLabel: gradingResult.gradeLabel,
      confidence: gradingResult.confidence,
      notes: gradingResult.overallNotes,
    },
    price: priceData,
    roi: roiAnalysis,
    agent: agentMetaSync(),
  });
}
