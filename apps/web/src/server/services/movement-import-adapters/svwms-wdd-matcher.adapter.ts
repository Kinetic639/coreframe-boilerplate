import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../inventory-movements.service";
import { WddMatcherService, type WddMovementImportCandidateLine } from "../wdd-matcher.service";
import type {
  CanonicalMovementImportDocument,
  CanonicalMovementImportLine,
  MovementImportSourceAdapter,
} from "./types";

function serviceError(result: ServiceResult<unknown>) {
  return (result as { success: false; error: string }).error;
}

function stringInput(sourceInput: Record<string, unknown>, key: string) {
  const value = sourceInput[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueValues(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function compactSessionReference(session: {
  id: string;
  created_at: string;
  session_number?: string | null;
}) {
  const existing = session.session_number?.trim();
  if (existing) return existing;
  const datePart = session.created_at.slice(0, 10).replaceAll("-", "");
  return `SVWMS-${datePart}-${session.id.slice(0, 8).toUpperCase()}`;
}

function movementOrderNumber(line: WddMovementImportCandidateLine) {
  return line.zlNumber ?? line.orderNumber ?? line.zwNumber ?? null;
}

const SVWMS_SENDER_NAME = "SVWMS realokacja";

function lineToCanonicalLine(line: WddMovementImportCandidateLine): CanonicalMovementImportLine {
  return {
    sourceLineId: line.sourceLineId,
    lineNumber: line.lineNumber,
    rawProductCode: line.productCode,
    rawProductName: line.productName,
    rawUnit: line.unit,
    rawQuantity: line.quantity,
    rawLocation: line.parsedLocation,
    rawMetadata: {
      source_block_id: line.sourceBlockId,
      source_block_type: line.sourceBlockType,
      wdd_number: line.wddNumber,
      order_number: line.orderNumber,
      zl_number: line.zlNumber,
      zw_number: line.zwNumber,
      movement_order_number: movementOrderNumber(line),
      client_name: line.clientName,
      group_name: line.groupName,
      warehouse_code: line.warehouseCode,
      warehouse_label: line.warehouseLabel,
      document_brand: line.documentBrand,
      parsed_location: line.parsedLocation,
      match_type: line.matchType,
      match_confidence: line.matchConfidence,
      block_metadata: line.blockMetadata,
      line_metadata: line.lineMetadata,
    },
  };
}

function candidatesToCanonicalDocument(
  session: {
    id: string;
    name: string;
    created_at: string;
    status: string;
    session_number?: string | null;
  },
  lines: WddMovementImportCandidateLine[]
): CanonicalMovementImportDocument {
  const movementOrderNumbers = uniqueValues(lines.map(movementOrderNumber));
  const sessionReference = compactSessionReference(session);

  return {
    sourceDocumentId: `svwms-session:${session.id}`,
    sourceDocumentNumber: sessionReference,
    externalReference: sessionReference,
    senderName: SVWMS_SENDER_NAME,
    senderDetails: { name: SVWMS_SENDER_NAME },
    recipientName: null,
    recipientDetails: null,
    sourceMetadata: {
      session_id: session.id,
      session_name: session.name,
      session_reference_number: sessionReference,
      session_status: session.status,
      session_created_at: session.created_at,
      import_scope: "session_incoming_items",
      line_count: lines.length,
      movement_order_numbers: movementOrderNumbers,
    },
    lines: lines.map(lineToCanonicalLine),
  };
}

export const svwmsWddMatcherMovementImportAdapter: MovementImportSourceAdapter = {
  sourceType: "svwms_wdd_matcher",
  label: "SVWMS WDD matcher",
  description: "Import incoming items from an authenticated SVWMS matcher session.",
  supportedMovementTypeCodes: ["101"],
  inputFields: [
    {
      key: "session_id",
      label: "Matcher session",
      type: "select",
      placeholder: "Select parsed SVWMS matcher session",
      required: true,
    },
  ],
  async loadSourceFields(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    movementTypeCode: string
  ) {
    if (movementTypeCode !== "101") {
      return { success: true, data: [] };
    }

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
          label: "Matcher session",
          type: "select",
          placeholder: "Select parsed SVWMS matcher session",
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
  async loadCanonicalDocuments(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    sourceInput: Record<string, unknown>
  ) {
    const sessionId = stringInput(sourceInput, "session_id");
    if (!sessionId) return { success: false, error: "Matcher session ID is required" };

    const candidates = await WddMatcherService.getMovementImportCandidates(
      supabase,
      sessionId,
      orgId,
      branchId
    );
    if (!candidates.success) return { success: false, error: serviceError(candidates) };
    if (candidates.data.lines.length === 0) {
      return { success: false, error: "Matcher session has no importable incoming items" };
    }

    return {
      success: true,
      data: [candidatesToCanonicalDocument(candidates.data.session, candidates.data.lines)],
    };
  },
};
