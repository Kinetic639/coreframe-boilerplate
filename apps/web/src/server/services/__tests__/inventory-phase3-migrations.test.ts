import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(__dirname, "../../../../supabase-target/supabase/migrations");
const phase3MigrationPath = path.join(
  migrationsDir,
  "20260508090000_inventory_phase3_advanced_features.sql"
);

function readPhase3Migration() {
  return fs.readFileSync(phase3MigrationPath, "utf8");
}

function tableBlock(sql: string, tableName: string) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${escaped} \\(([\\s\\S]*?)\\n\\);`, "i")
  );
  if (!match) throw new Error(`Missing CREATE TABLE block for ${tableName}`);
  return match[1];
}

describe("Ambra Inventory V2 Phase 3 migration", () => {
  it("creates the required Phase 3 advanced tables", () => {
    const sql = readPhase3Migration();
    for (const tableName of [
      "inventory_unit_conversions",
      "inventory_product_unit_conversions",
      "inventory_custom_fields",
      "inventory_custom_field_values",
      "inventory_collections",
      "inventory_collection_items",
      "inventory_saved_views",
      "inventory_import_jobs",
      "inventory_export_jobs",
      "inventory_valuation_snapshots",
      "inventory_report_runs",
      "inventory_count_sessions",
      "inventory_count_lines",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${tableName}`);
    }
  });

  it("adds pattern-based SKU generation while preserving atomic settings locking", () => {
    const sql = readPhase3Migration();

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS sku_pattern");
    expect(sql).toContain("inventory_build_sku_from_pattern");
    expect(sql).toContain("inventory_preview_sku");
    expect(sql).toContain("SELECT *");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("SET sku_next = sku_next + 1");
  });

  it("models global and product-specific unit conversions with positive factors", () => {
    const sql = readPhase3Migration();
    const globalBlock = tableBlock(sql, "inventory_unit_conversions");
    const productBlock = tableBlock(sql, "inventory_product_unit_conversions");

    expect(globalBlock).toContain("factor numeric(24, 12) not null");
    expect(productBlock).toContain("rounding_mode text not null default 'half_up'");
    expect(sql).toContain("inventory_convert_quantity");
    expect(sql).toContain("No unit conversion exists for the requested units");
  });

  it("keeps custom field lot and serial values behind real foreign keys", () => {
    const sql = readPhase3Migration();
    const valuesBlock = tableBlock(sql, "inventory_custom_field_values");

    expect(valuesBlock).toContain(
      "lot_id uuid null references public.inventory_lots(id) on delete cascade"
    );
    expect(valuesBlock).toContain(
      "serial_id uuid null references public.inventory_serials(id) on delete cascade"
    );
    expect(valuesBlock).toContain("num_nonnulls(product_id, variant_id, lot_id, serial_id) = 1");
    expect(sql).toContain("is_filterable boolean not null default false");
  });

  it("implements inventory counts through adjustment movements instead of balance edits", () => {
    const sql = readPhase3Migration();

    expect(sql).toContain("inventory_create_count_session");
    expect(sql).toContain("inventory_approve_count_session");
    expect(sql).toContain("'inventory_count'");
    expect(sql).toContain("inventory_create_draft_movement");
    expect(sql).toContain("inventory_post_movement");
    expect(sql).not.toContain("UPDATE public.inventory_balances");
  });

  it("uses exact Phase 3 permission slugs and recompiles permission snapshots", () => {
    const sql = readPhase3Migration();

    expect(sql).toContain("'warehouse.reports.read'");
    expect(sql).toContain("'warehouse.imports.manage'");
    expect(sql).toContain("compile_user_permissions");
    expect(sql).not.toMatch(/has_(?:branch_)?permission\([^;]*'warehouse\.\*'/);
  });
});
