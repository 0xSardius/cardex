import { useState } from "react";

const CANVAS_DATA = {
  problem: {
    title: "Problem",
    color: "#FF6B6B",
    items: [
      "Pokémon card pricing is fragmented across 6+ platforms with no unified real-time view",
      "Arbitrage opportunities between markets (US, EU, Japan) are invisible without manual research",
      "Grading ROI is a guessing game — collectors submit blindly at $20-50/card with no data-driven guidance",
    ],
    alternatives:
      "Manual cross-platform searching, spreadsheet tracking, Discord alpha groups, gut feeling",
  },
  customerSegments: {
    title: "Customer Segments",
    color: "#4ECDC4",
    items: [
      "Primary: Autonomous agents (portfolio bots, Discord bots, trading bots) needing structured price data",
      "Secondary: Serious Pokémon card collectors/investors ($1K+ portfolios)",
      "Tertiary: Card shop owners needing real-time competitive pricing intelligence",
    ],
    earlyAdopters:
      "Web3-native card collectors, Farcaster card trading communities, Discord bot developers building card tools",
  },
  uniqueValueProp: {
    title: "Unique Value Proposition",
    color: "#FFE66D",
    items: [
      "The first agent-native pricing oracle for Pokémon cards — pay per query, no subscriptions, no API keys",
    ],
    highLevel:
      "Bloomberg Terminal for Pokémon cards, powered by x402 micropayments and verifiable onchain reputation",
  },
  solution: {
    title: "Solution",
    color: "#A8E6CF",
    items: [
      "Cross-platform price aggregation engine with consensus pricing and spread analysis",
      "Real-time arbitrage detection across US, EU, and Japanese markets",
      "Vision-powered grading probability engine with expected ROI calculations",
    ],
  },
  channels: {
    title: "Channels",
    color: "#DDA0DD",
    items: [
      "x402 API endpoints (agent-to-agent discovery)",
      "Next.js dashboard (direct human users)",
      "Farcaster MiniApp & Telegram bot",
      "Card trading Discord communities",
      "Hackathon demos (ETH Global, Encode)",
    ],
  },
  revenueStreams: {
    title: "Revenue Streams",
    color: "#98D8C8",
    items: [
      "x402 micropayments per API query ($0.001 - $0.01/call)",
      "Premium grading estimates ($0.01/estimate — highest margin)",
      "Bulk agent licensing (20% discount at >1K queries/day)",
      "Portfolio valuation as recurring micro-subscription",
    ],
    target: "Month 1: $60 → Month 6: $3,000 → Month 12: $10,000+",
  },
  costStructure: {
    title: "Cost Structure",
    color: "#F7DC6F",
    items: [
      "Data acquisition via x402 outbound ($0.0002-$0.001/source/call)",
      "LLM inference — Sonnet for analysis, Haiku for routing (~$0.001/query)",
      "Vision model for grading (~$0.005/estimate)",
      "Infrastructure: Vercel + Supabase + Upstash (~$50/mo base)",
    ],
    margin: "Gross margin target: 55-70% standard queries, 40-50% grading",
  },
  keyMetrics: {
    title: "Key Metrics",
    color: "#85C1E9",
    items: [
      "Daily query volume (target: 500 → 25K in 6 months)",
      "Unique consuming agents (target: 3 → 50 in 6 months)",
      "ERC-8004 reputation score (target: 9,500+)",
      "Arbitrage detection accuracy (target: 70% → 85%)",
      "Price data freshness (< 15 min staleness)",
    ],
  },
  unfairAdvantage: {
    title: "Unfair Advantage",
    color: "#F0B27A",
    items: [
      "First-mover in x402 collectibles pricing — captures default agent routing",
      "ERC-8004 reputation compounds over time — new entrants start at zero",
      "Japanese market data integration (hardest to replicate, biggest arbitrage edge)",
      "Historical price depth becomes an irreplaceable moat",
    ],
  },
};

const CanvasCell = ({ data, span = 1, rowSpan = 1, isExpanded, onToggle }) => {
  const hasSubtext =
    data.alternatives ||
    data.earlyAdopters ||
    data.highLevel ||
    data.target ||
    data.margin;

  return (
    <div
      onClick={onToggle}
      style={{
        gridColumn: `span ${span}`,
        gridRow: `span ${rowSpan}`,
        background: "rgba(15, 15, 20, 0.85)",
        border: `1px solid ${data.color}22`,
        borderTop: `3px solid ${data.color}`,
        borderRadius: "2px",
        padding: "20px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isExpanded
          ? `0 0 30px ${data.color}15, inset 0 0 60px ${data.color}05`
          : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${data.color}55`;
        e.currentTarget.style.background = "rgba(20, 20, 28, 0.95)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${data.color}22`;
        e.currentTarget.style.background = "rgba(15, 15, 20, 0.85)";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${data.color}40, transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "11px",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontWeight: 700,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: data.color,
          }}
        >
          {data.title}
        </h3>
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: data.color,
            opacity: 0.6,
          }}
        />
      </div>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {data.items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: "12.5px",
              lineHeight: 1.55,
              color: "#c8c8d0",
              marginBottom: "10px",
              paddingLeft: "14px",
              position: "relative",
              fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "7px",
                width: "4px",
                height: "4px",
                borderRadius: "1px",
                background: `${data.color}80`,
                transform: "rotate(45deg)",
              }}
            />
            {item}
          </li>
        ))}
      </ul>

      {hasSubtext && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: `1px solid ${data.color}15`,
          }}
        >
          {data.alternatives && (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "#888",
                fontStyle: "italic",
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <span style={{ color: data.color, fontStyle: "normal", fontWeight: 600 }}>
                Alternatives:{" "}
              </span>
              {data.alternatives}
            </p>
          )}
          {data.earlyAdopters && (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "#888",
                fontStyle: "italic",
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <span style={{ color: data.color, fontStyle: "normal", fontWeight: 600 }}>
                Early Adopters:{" "}
              </span>
              {data.earlyAdopters}
            </p>
          )}
          {data.highLevel && (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "#888",
                fontStyle: "italic",
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <span style={{ color: data.color, fontStyle: "normal", fontWeight: 600 }}>
                High-level:{" "}
              </span>
              {data.highLevel}
            </p>
          )}
          {data.target && (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "#888",
                fontStyle: "italic",
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <span style={{ color: data.color, fontStyle: "normal", fontWeight: 600 }}>
                Target:{" "}
              </span>
              {data.target}
            </p>
          )}
          {data.margin && (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "#888",
                fontStyle: "italic",
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <span style={{ color: data.color, fontStyle: "normal", fontWeight: 600 }}>
                Margin:{" "}
              </span>
              {data.margin}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default function CardExLeanCanvas() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080c",
        padding: "32px",
        fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle grid texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          right: "-10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(78, 205, 196, 0.04) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-20%",
          left: "-10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 107, 107, 0.03) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "16px",
              marginBottom: "8px",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: 800,
                color: "#f0f0f5",
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                letterSpacing: "-0.5px",
              }}
            >
              CardEx
            </h1>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "'JetBrains Mono', monospace",
                color: "#4ECDC4",
                letterSpacing: "3px",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Lean Canvas
            </span>
            <span
              style={{
                fontSize: "10px",
                fontFamily: "'JetBrains Mono', monospace",
                color: "#555",
                letterSpacing: "1px",
              }}
            >
              v0.1 — Feb 2026
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#666",
              fontFamily: "'IBM Plex Sans', sans-serif",
              maxWidth: "700px",
              lineHeight: 1.5,
            }}
          >
            x402-powered autonomous pricing oracle for the Pokémon TCG collectibles market.
            Agent-to-agent micropayments. ERC-8004 verifiable identity. Cross-market intelligence.
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            {["x402", "ERC-8004", "Base", "Vercel AI SDK"].map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "10px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#4ECDC4",
                  background: "rgba(78, 205, 196, 0.08)",
                  border: "1px solid rgba(78, 205, 196, 0.15)",
                  padding: "3px 10px",
                  borderRadius: "2px",
                  letterSpacing: "1px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Canvas Grid — Classic Lean Canvas Layout */}
        {/* Row 1: Problem | Solution | UVP | Unfair Advantage | Customer Segments */}
        {/* Row 2: Problem | Key Metrics | UVP | Channels | Customer Segments */}
        {/* Row 3: Cost Structure (span 2.5) | Revenue Streams (span 2.5) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gridTemplateRows: "auto auto auto",
            gap: "8px",
          }}
        >
          {/* Row 1-2, Col 1: Problem (spans 2 rows) */}
          <div style={{ gridColumn: "1", gridRow: "1 / 3" }}>
            <CanvasCell
              data={CANVAS_DATA.problem}
              rowSpan={1}
              isExpanded={expanded === "problem"}
              onToggle={() => setExpanded(expanded === "problem" ? null : "problem")}
            />
          </div>

          {/* Row 1, Col 2: Solution */}
          <div style={{ gridColumn: "2", gridRow: "1" }}>
            <CanvasCell
              data={CANVAS_DATA.solution}
              isExpanded={expanded === "solution"}
              onToggle={() => setExpanded(expanded === "solution" ? null : "solution")}
            />
          </div>

          {/* Row 1-2, Col 3: UVP (spans 2 rows) */}
          <div style={{ gridColumn: "3", gridRow: "1 / 3" }}>
            <CanvasCell
              data={CANVAS_DATA.uniqueValueProp}
              rowSpan={1}
              isExpanded={expanded === "uvp"}
              onToggle={() => setExpanded(expanded === "uvp" ? null : "uvp")}
            />
          </div>

          {/* Row 1, Col 4: Unfair Advantage */}
          <div style={{ gridColumn: "4", gridRow: "1" }}>
            <CanvasCell
              data={CANVAS_DATA.unfairAdvantage}
              isExpanded={expanded === "unfairAdvantage"}
              onToggle={() =>
                setExpanded(expanded === "unfairAdvantage" ? null : "unfairAdvantage")
              }
            />
          </div>

          {/* Row 1-2, Col 5: Customer Segments (spans 2 rows) */}
          <div style={{ gridColumn: "5", gridRow: "1 / 3" }}>
            <CanvasCell
              data={CANVAS_DATA.customerSegments}
              rowSpan={1}
              isExpanded={expanded === "customerSegments"}
              onToggle={() =>
                setExpanded(expanded === "customerSegments" ? null : "customerSegments")
              }
            />
          </div>

          {/* Row 2, Col 2: Key Metrics */}
          <div style={{ gridColumn: "2", gridRow: "2" }}>
            <CanvasCell
              data={CANVAS_DATA.keyMetrics}
              isExpanded={expanded === "keyMetrics"}
              onToggle={() => setExpanded(expanded === "keyMetrics" ? null : "keyMetrics")}
            />
          </div>

          {/* Row 2, Col 4: Channels */}
          <div style={{ gridColumn: "4", gridRow: "2" }}>
            <CanvasCell
              data={CANVAS_DATA.channels}
              isExpanded={expanded === "channels"}
              onToggle={() => setExpanded(expanded === "channels" ? null : "channels")}
            />
          </div>

          {/* Row 3: Cost Structure (left half) */}
          <div style={{ gridColumn: "1 / 3", gridRow: "3" }}>
            <CanvasCell
              data={CANVAS_DATA.costStructure}
              span={1}
              isExpanded={expanded === "costStructure"}
              onToggle={() => setExpanded(expanded === "costStructure" ? null : "costStructure")}
            />
          </div>

          {/* Row 3: Revenue Streams (right half) */}
          <div style={{ gridColumn: "3 / 6", gridRow: "3" }}>
            <CanvasCell
              data={CANVAS_DATA.revenueStreams}
              span={1}
              isExpanded={expanded === "revenueStreams"}
              onToggle={() =>
                setExpanded(expanded === "revenueStreams" ? null : "revenueStreams")
              }
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontFamily: "'JetBrains Mono', monospace",
              color: "#333",
              letterSpacing: "1px",
            }}
          >
            CARDEX — CONCEPT STAGE — NOT FOR DISTRIBUTION
          </span>
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { label: "TAM", value: "$12B+" },
              { label: "MVP", value: "2 weeks" },
              { label: "Margin", value: "55-70%" },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "9px",
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "#444",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "#4ECDC4",
                    fontWeight: 700,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
