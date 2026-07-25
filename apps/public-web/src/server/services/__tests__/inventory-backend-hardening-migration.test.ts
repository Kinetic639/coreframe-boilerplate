import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../../../supabase-target/supabase/migrations/20260520143000_inventory_backend_hardening.sql"
);

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

describe("Ambra Inventory backend hardening migration", () => {
  it("repairs RLS drift by enabling and forcing RLS on tenant-owned inventory tables", () => {
    const sql = readMigration();

    for (const tableName of [
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
      expect(sql).toContain(`'${tableName}'`);
    }

    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("'warehouse.products.read'");
    expect(sql).toContain("'warehouse.products.manage'");
    expect(sql).toContain("'warehouse.imports.manage'");
    expect(sql).toContain("'warehouse.reports.read'");
    expect(sql).toContain("'warehouse.inventory.adjust'");
    expect(sql).not.toMatch(/has_(?:branch_)?permission\([^;]*'warehouse\.\*'/);
  });

  it("fixes transfer-line organization correlation with qualified references and a composite FK", () => {
    const sql = readMigration();

    expect(sql).toContain("inventory_branch_transfers_id_org_uidx");
    expect(sql).toContain("inventory_branch_transfer_lines_transfer_org_fkey");
    expect(sql).toContain("FOREIGN KEY (transfer_id, organization_id)");
    expect(sql).toContain("REFERENCES public.inventory_branch_transfers (id, organization_id)");
    expect(sql).toContain("t.organization_id = inventory_branch_transfer_lines.organization_id");
    expect(sql).not.toContain("t.organization_id = t.organization_id");
  });

  it("uses invoker view security and removes broad public storage listing", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "ALTER VIEW public.inventory_balance_analytics SET (security_invoker = true)"
    );
    expect(sql).toContain(
      "DROP POLICY IF EXISTS inventory_item_images_storage_public_read ON storage.objects"
    );
  });

  it("adds canonical SKU fingerprinting, uniqueness, and collision lookup RPC", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_sku_fingerprint");
    expect(sql).toContain("inventory_variants_org_sku_fingerprint_active_uidx");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_find_sku_collisions");
    expect(sql).toContain("public.inventory_sku_fingerprint(v.sku)");
    expect(sql).toContain("SECURITY INVOKER");
  });
});
