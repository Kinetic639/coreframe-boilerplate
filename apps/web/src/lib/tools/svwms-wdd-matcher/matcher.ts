/**
 * SVWMS WDD Matcher — Block Matching Engine
 *
 * Truth model:
 *   WDD block  (bc file)     = what physically arrived (AUTHORITATIVE)
 *   ORDER block (brand file) = the business context (ENRICHMENT SOURCE)
 *
 * Relationship:  WDD product codes ⊆ ORDER product codes
 *
 * An order may cover more parts than one delivery.  The matcher finds,
 * for each WDD block, the ORDER block whose product codes are a superset
 * of (or exact match to) the WDD block's product codes.
 *
 * Match types:
 *   exact     – identical code sets AND quantities match
 *   subset    – all WDD codes in ORDER, ORDER has more codes
 *   partial   – ≥ 50 % of WDD codes found in ORDER
 *   ambiguous – two ORDER candidates score within 10 points of each other
 *   unmatched_bc    – WDD block with no suitable ORDER candidate
 *   unmatched_brand – ORDER block not referenced by any WDD block
 */

import type {
  WddMatcherBlock,
  WddMatcherLine,
  BlockMatchInsertInput,
  MatchSummary,
} from "@/server/services/wdd-matcher.service";
import type { BlockMatchType } from "@/lib/validations/wdd-matcher";

/* -----------------------------------------------------------------------
 * Types
 * --------------------------------------------------------------------- */

export interface EnrichSummary {
  exact: number;
  subset: number;
  partial: number;
  ambiguous: number;
  unmatched_bc: number;
  unmatched_brand: number;
  total_wdd_blocks: number;
  direct_orders: number;
}

export interface EnrichResult {
  matches: BlockMatchInsertInput[];
  summary: EnrichSummary;
}

/* -----------------------------------------------------------------------
 * Normalization
 * --------------------------------------------------------------------- */

/** Strips whitespace and uppercases — used to compare product codes */
function normalizeCode(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, "").trim();
}

/* -----------------------------------------------------------------------
 * Score a WDD block against a single ORDER candidate
 *
 * Returns a score 0–100 and a proposed match type.
 * --------------------------------------------------------------------- */

interface ScoreResult {
  score: number;
  matchType: Exclude<BlockMatchType, "ambiguous" | "unmatched_bc" | "unmatched_brand">;
  reasons: string[];
}

function scoreCandidate(wddLines: WddMatcherLine[], orderLines: WddMatcherLine[]): ScoreResult {
  // Build code → quantity maps
  const wddMap = new Map<string, number | null>();
  for (const l of wddLines) {
    const c = normalizeCode(l.product_code);
    if (c) wddMap.set(c, l.quantity);
  }

  const orderMap = new Map<string, number | null>();
  for (const l of orderLines) {
    const c = normalizeCode(l.product_code);
    if (c) orderMap.set(c, l.quantity);
  }

  if (wddMap.size === 0) {
    // WDD block has no parseable codes — cannot match
    return { score: 0, matchType: "partial", reasons: ["WDD block has no product codes"] };
  }

  // Intersection: WDD codes that appear in ORDER
  const intersection: string[] = [];
  for (const code of wddMap.keys()) {
    if (orderMap.has(code)) intersection.push(code);
  }

  const overlapRatio = intersection.length / wddMap.size;

  if (overlapRatio === 0) {
    return { score: 0, matchType: "partial", reasons: ["no code overlap"] };
  }

  const reasons: string[] = [];

  // How many matching codes also have matching quantities?
  let qtyMatch = 0;
  for (const code of intersection) {
    const wQty = wddMap.get(code);
    const oQty = orderMap.get(code);
    if (wQty !== null && wQty !== undefined && oQty !== null && oQty !== undefined) {
      if (Math.abs(wQty - oQty) < 0.001) qtyMatch++;
    }
  }
  const qtyMatchRatio = intersection.length > 0 ? qtyMatch / intersection.length : 0;

  // --- Case 1: All WDD codes found in ORDER (overlap 100%) ---
  if (overlapRatio >= 0.999) {
    const orderOnly = orderMap.size - intersection.length;
    reasons.push(`${intersection.length}/${wddMap.size} WDD codes in ORDER`);

    if (orderOnly === 0) {
      // Same code sets
      if (qtyMatchRatio >= 0.999) {
        reasons.push("all quantities match");
        return { score: 100, matchType: "exact", reasons };
      }
      // Codes match but qty differences
      const score = Math.round(75 + qtyMatchRatio * 15);
      reasons.push(`quantity match ratio: ${Math.round(qtyMatchRatio * 100)}%`);
      return { score, matchType: "partial", reasons };
    }

    // WDD is a subset of ORDER — this is the expected pattern (one order can
    // cover several deliveries).  Extra ORDER lines are not a negative signal;
    // penalise them only very slightly.
    // Scoring: base 85 + up to 12 for qty match – at most 5 for surplus.
    const surplusPenalty = Math.min(5, Math.round((orderOnly / orderMap.size) * 5));
    const score = Math.round(85 + qtyMatchRatio * 12 - surplusPenalty);
    reasons.push(`ORDER has ${orderOnly} extra codes (WDD is a subset)`);
    if (qtyMatchRatio > 0.9) reasons.push("quantities match");
    return { score: Math.max(80, score), matchType: "subset", reasons };
  }

  // --- Case 2: Partial overlap (50–99%) ---
  if (overlapRatio >= 0.5) {
    const score = Math.round(overlapRatio * 65 + qtyMatchRatio * 10);
    reasons.push(
      `${Math.round(overlapRatio * 100)}% of WDD codes found in ORDER`,
      `qty match: ${Math.round(qtyMatchRatio * 100)}%`
    );
    return { score, matchType: "partial", reasons };
  }

  // --- Case 3: Low overlap (< 50%) — weak signal ---
  const score = Math.round(overlapRatio * 40);
  reasons.push(`low overlap: ${Math.round(overlapRatio * 100)}%`);
  return { score, matchType: "partial", reasons };
}

/* -----------------------------------------------------------------------
 * Main enrichment function
 * --------------------------------------------------------------------- */

export function runWddEnrichment(
  blocks: WddMatcherBlock[],
  linesByBlockId: Map<string, WddMatcherLine[]>
): EnrichResult {
  const matches: BlockMatchInsertInput[] = [];
  const summary: EnrichSummary = {
    exact: 0,
    subset: 0,
    partial: 0,
    ambiguous: 0,
    unmatched_bc: 0,
    unmatched_brand: 0,
    total_wdd_blocks: 0,
    direct_orders: 0,
  };

  // Partition blocks
  const wddBlocks = blocks.filter((b) => b.block_type === "wdd_reconciliation" && !b.is_excluded);
  const orderBlocks = blocks.filter((b) => b.block_type === "brand_order" && !b.is_excluded);
  const directOrderBlocks = blocks.filter((b) => b.block_type === "direct_order" && !b.is_excluded);

  summary.total_wdd_blocks = wddBlocks.length;
  summary.direct_orders = directOrderBlocks.length;

  // Track which ORDER blocks were matched (for unmatched_brand output)
  const matchedOrderIds = new Set<string>();

  for (const wdd of wddBlocks) {
    const wddLines = linesByBlockId.get(wdd.id) ?? [];

    // Case: parser produced no rows for this WDD block
    if (wddLines.length === 0) {
      matches.push({
        bcBlockId: wdd.id,
        brandBlockId: null,
        wddBlockId: null,
        blockMatchType: "unmatched_bc",
        blockConfidence: 0,
        blockMatchReasons: {
          reason: "WDD block has no parsed product rows",
          unmatchedReason: "parser_empty_rows",
        },
        reviewStatus: "pending",
      });
      summary.unmatched_bc++;
      continue;
    }

    // Case: no order blocks in session at all
    if (orderBlocks.length === 0) {
      matches.push({
        bcBlockId: wdd.id,
        brandBlockId: null,
        wddBlockId: null,
        blockMatchType: "unmatched_bc",
        blockConfidence: 0,
        blockMatchReasons: {
          reason: "no ORDER blocks in session",
          unmatchedReason: "no_candidate_orders",
        },
        reviewStatus: "pending",
      });
      summary.unmatched_bc++;
      continue;
    }

    // Fast path: WDD has exactly 1 unique product code.
    // Scan order blocks for that code directly — no scoring needed.
    const wddUniqueCodes = [
      ...new Set(wddLines.map((l) => normalizeCode(l.product_code)).filter(Boolean)),
    ];
    if (wddUniqueCodes.length === 1) {
      const targetCode = wddUniqueCodes[0];
      const wddQty =
        wddLines.find((l) => normalizeCode(l.product_code) === targetCode)?.quantity ?? null;
      let fastMatched = false;

      for (const order of orderBlocks) {
        const orderLines = linesByBlockId.get(order.id) ?? [];
        const matchLine = orderLines.find((ol) => normalizeCode(ol.product_code) === targetCode);
        if (matchLine) {
          const qtyMatches =
            wddQty !== null &&
            matchLine.quantity !== null &&
            Math.abs(wddQty - matchLine.quantity) < 0.001;
          const matchType: BlockMatchType = qtyMatches ? "exact" : "subset";
          matches.push({
            bcBlockId: wdd.id,
            brandBlockId: order.id,
            wddBlockId: null,
            blockMatchType: matchType,
            blockConfidence: qtyMatches ? 100 : 85,
            blockMatchReasons: {
              reasons: [
                "single-code fast path",
                `code: ${targetCode}`,
                qtyMatches ? "qty match" : "qty mismatch",
              ],
            },
            reviewStatus: qtyMatches ? "approved" : "pending",
          });
          if (matchType === "exact") summary.exact++;
          else summary.subset++;
          matchedOrderIds.add(order.id);
          fastMatched = true;
          break;
        }
      }

      if (fastMatched) continue;
      // No order contained the code — fall through to normal scoring / unmatched
    }

    // Score against every ORDER candidate
    interface Candidate {
      block: WddMatcherBlock;
      score: number;
      matchType: Exclude<BlockMatchType, "ambiguous" | "unmatched_bc" | "unmatched_brand">;
      reasons: string[];
    }

    const candidates: Candidate[] = [];

    for (const order of orderBlocks) {
      const orderLines = linesByBlockId.get(order.id) ?? [];
      if (orderLines.length === 0) continue;

      const result = scoreCandidate(wddLines, orderLines);
      if (result.score > 0) {
        candidates.push({
          block: order,
          score: result.score,
          matchType: result.matchType,
          reasons: result.reasons,
        });
      }
    }

    // No candidates at all — codes exist but no order shares any codes
    if (candidates.length === 0) {
      matches.push({
        bcBlockId: wdd.id,
        brandBlockId: null,
        wddBlockId: null,
        blockMatchType: "unmatched_bc",
        blockConfidence: 0,
        blockMatchReasons: {
          reason: "no ORDER candidate found — codes not present in any order file",
          unmatchedReason: "internal_or_direct_delivery",
        },
        reviewStatus: "pending",
      });
      summary.unmatched_bc++;
      continue;
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const second = candidates[1];

    // Minimum confidence threshold — below this we treat as unmatched
    const MIN_CONFIDENCE = 40;

    if (best.score < MIN_CONFIDENCE) {
      matches.push({
        bcBlockId: wdd.id,
        brandBlockId: null,
        wddBlockId: null,
        blockMatchType: "unmatched_bc",
        blockConfidence: best.score,
        blockMatchReasons: {
          reason: "best candidate below minimum confidence",
          unmatchedReason: "low_overlap",
          best_candidate_id: best.block.id,
          best_score: best.score,
        },
        reviewStatus: "pending",
      });
      summary.unmatched_bc++;
      continue;
    }

    // Ambiguous: two candidates within 10 points of each other
    if (second && second.score >= MIN_CONFIDENCE && best.score - second.score <= 10) {
      matches.push({
        bcBlockId: wdd.id,
        brandBlockId: best.block.id,
        wddBlockId: null,
        blockMatchType: "ambiguous",
        blockConfidence: best.score,
        blockMatchReasons: {
          reasons: best.reasons,
          second_candidate_id: second.block.id,
          second_score: second.score,
        },
        reviewStatus: "pending",
      });
      summary.ambiguous++;
      matchedOrderIds.add(best.block.id);
      continue;
    }

    // Clear winner
    const finalType: BlockMatchType = best.matchType;
    matches.push({
      bcBlockId: wdd.id,
      brandBlockId: best.block.id,
      wddBlockId: null,
      blockMatchType: finalType,
      blockConfidence: best.score,
      blockMatchReasons: { reasons: best.reasons },
      reviewStatus: finalType === "exact" ? "approved" : "pending",
    });

    if (finalType === "exact") summary.exact++;
    else if (finalType === "subset") summary.subset++;
    else summary.partial++;

    matchedOrderIds.add(best.block.id);
  }

  // Unmatched ORDER blocks
  for (const order of orderBlocks) {
    if (!matchedOrderIds.has(order.id)) {
      matches.push({
        bcBlockId: null,
        brandBlockId: order.id,
        wddBlockId: null,
        blockMatchType: "unmatched_brand",
        blockConfidence: 0,
        blockMatchReasons: { reason: "no WDD block matched this ORDER" },
        reviewStatus: "pending",
      });
      summary.unmatched_brand++;
    }
  }

  return { matches, summary };
}

/* -----------------------------------------------------------------------
 * Summary conversion
 * --------------------------------------------------------------------- */

export function toMatchSummary(summary: EnrichSummary): MatchSummary {
  return {
    exact_block_matches: summary.exact,
    partial_block_matches: summary.subset + summary.partial + summary.ambiguous,
    unmatched_bc: summary.unmatched_bc,
    unmatched_brand: summary.unmatched_brand,
    total_lines_matched: 0,
    total_wdd_blocks: summary.total_wdd_blocks,
    direct_orders: summary.direct_orders,
  };
}
