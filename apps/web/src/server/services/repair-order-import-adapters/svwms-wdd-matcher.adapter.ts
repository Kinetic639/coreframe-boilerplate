import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WddMatcherService,
  type WddMatcherBlock,
  type WddMatcherLine,
} from "../wdd-matcher.service";
import type { CanonicalRepairOrderImportOrder, RepairOrderImportSourceAdapter } from "./types";

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function serviceError(result: { success: boolean }) {
  return (result as { success: false; error: string }).error;
}

/**
 * Repair orders from a saved Matcher session: every brand order / direct
 * order block that carries a ZL number is one repair order, its lines are
 * the ordered parts. The Matcher itself only parses and matches; creating
 * the orders happens here, on purpose, in the Workshop or PZ import.
 */
export const svwmsWddMatcherRepairOrderImportAdapter: RepairOrderImportSourceAdapter = {
  sourceType: "svwms_wdd_matcher",
  label: "Matcher (sesja dostawy)",
  description: "Zlecenia z dokumentów zamówień marki w zapisanej sesji Matchera.",
  async loadSourceFields(supabase, orgId, branchId) {
    const sessions = await WddMatcherService.listImportableSessionsForBranch(
      supabase,
      orgId,
      branchId
    );
    if (!sessions.success) return { success: false, error: serviceError(sessions) };
    return {
      success: true,
      data: [
        {
          key: "session_id",
          label: "Sesja Matchera",
          type: "select",
          required: true,
          options: sessions.data.map((session) => ({
            value: session.id,
            label: session.name || new Date(session.created_at).toLocaleString("pl-PL"),
            description: session.created_at,
          })),
        },
      ],
    };
  },
  async loadOrders(supabase: SupabaseClient, orgId, branchId, sourceInput) {
    const sessionId =
      typeof sourceInput.session_id === "string" ? sourceInput.session_id.trim() : "";
    if (!sessionId) return { success: false, error: "Wybierz sesję Matchera" };

    const session = await WddMatcherService.getSession(supabase, sessionId, orgId);
    if (!session.success) return { success: false, error: serviceError(session) };
    if (!session.data || session.data.branch_id !== branchId) {
      return { success: false, error: "Nie znaleziono sesji Matchera w tym oddziale" };
    }

    const { data: blockRows, error: blocksError } = await supabase
      .from("wdd_matcher_blocks")
      .select("*")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId)
      .order("block_index", { ascending: true });
    if (blocksError) return { success: false, error: "Nie udało się wczytać sesji Matchera" };
    const blocks = ((blockRows ?? []) as WddMatcherBlock[]).filter(
      (block) =>
        !block.is_excluded &&
        (block.block_type === "brand_order" || block.block_type === "direct_order") &&
        metadataString(block.metadata, "zl_number")
    );
    if (blocks.length === 0) return { success: true, data: [] };

    const { data: lineRows, error: linesError } = await supabase
      .from("wdd_matcher_lines")
      .select("*")
      .in(
        "block_id",
        blocks.map((block) => block.id)
      )
      .eq("organization_id", orgId)
      .order("line_number", { ascending: true });
    if (linesError) return { success: false, error: "Nie udało się wczytać pozycji sesji" };
    const linesByBlock = new Map<string, WddMatcherLine[]>();
    for (const line of (lineRows ?? []) as WddMatcherLine[]) {
      const list = linesByBlock.get(line.block_id) ?? [];
      list.push(line);
      linesByBlock.set(line.block_id, list);
    }

    const orders: CanonicalRepairOrderImportOrder[] = blocks.map((block) => ({
      key: block.id,
      zlNumber: metadataString(block.metadata, "zl_number"),
      orderNumber: metadataString(block.metadata, "order_number"),
      vin: metadataString(block.metadata, "vin"),
      vehicleBrand: metadataString(block.metadata, "document_brand"),
      clientName: metadataString(block.metadata, "client_name"),
      dealerName: metadataString(block.metadata, "dealer_name"),
      source: { sessionId, blockId: block.id },
      lines: (linesByBlock.get(block.id) ?? [])
        .filter((line) => line.product_code || line.product_name || line.quantity)
        .map((line) => ({
          productCode: line.product_code,
          productName: line.product_name,
          quantity: line.quantity,
          unit: line.unit,
          rawText: line.raw_text,
          matcherLineId: line.id,
        })),
    }));
    return { success: true, data: orders };
  },
};
