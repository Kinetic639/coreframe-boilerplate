/**
 * SVWMS WDD Matcher — CSV Exporter
 *
 * Builds a UTF-8 CSV string with BOM for Polish character Excel compatibility.
 * No external library. One row per wdd_matcher_line_matches entry.
 */

import type { ExportRow } from "@/server/services/wdd-matcher.service";

const HEADERS = [
  "session_name",
  "session_status",
  "bc_file_name",
  "brand_file_name",
  "brand_file_label",
  "block_match_type",
  "block_confidence",
  "block_review_status",
  "bc_block_header",
  "bc_warehouse_section",
  "brand_block_header",
  "brand_to_section",
  "line_match_type",
  "line_confidence",
  "line_review_status",
  "bc_product_code",
  "bc_product_name",
  "bc_quantity",
  "bc_unit",
  "brand_product_code",
  "brand_product_name",
  "brand_quantity",
  "brand_unit",
  "wdd_corroborated",
  "wdd_product_code",
  "wdd_quantity",
  "discrepancy_fields",
  "discrepancy_detail",
  "reviewer_notes",
] as const;

/** Escape a single CSV cell value: wrap in double-quotes, escape inner quotes */
function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  // Always quote — simplest safe approach; avoids issues with commas, newlines, quotes
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildCsvString(rows: ExportRow[]): string {
  const lines: string[] = [];

  // Header row
  lines.push(HEADERS.map(escapeCsvCell).join(","));

  for (const row of rows) {
    const cells = HEADERS.map((h) => escapeCsvCell(row[h as keyof ExportRow]));
    lines.push(cells.join(","));
  }

  // UTF-8 BOM + CRLF line endings for Excel Polish character compatibility
  return "\uFEFF" + lines.join("\r\n");
}
