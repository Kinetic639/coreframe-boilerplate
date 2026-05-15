import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../../../supabase-target/supabase/migrations/20260510094000_inventory_product_creation_enhancements.sql"
);
const mvpMigrationPath = path.resolve(
  __dirname,
  "../../../../supabase-target/supabase/migrations/20260514100000_inventory_product_mvp_completion.sql"
);

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

function readMvpMigration() {
  return fs.readFileSync(mvpMigrationPath, "utf8");
}

describe("Ambra Inventory product creation enhancements migration", () => {
  it("adds Zoho-style product metadata fields", () => {
    const sql = readMigration();

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS returnable");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS brand_name");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS manufacturer_name");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS sales_description");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS purchase_description");
    expect(sql).toContain("preferred_supplier_id");
  });

  it("creates image, identifier, reorder, and tag foundations", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_product_identifiers");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_item_images");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_reorder_rules");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_tags");
    expect(sql).toContain("inventory-item-images");
  });

  it("protects new tables with product and branch-scoped policies", () => {
    const sql = readMigration();

    expect(sql).toContain("'warehouse.products.read'");
    expect(sql).toContain("'warehouse.products.manage'");
    expect(sql).toContain("'warehouse.inventory.read'");
    expect(sql).toContain("'warehouse.inventory.operate'");
    expect(sql).not.toMatch(/has_(?:branch_)?permission\([^;]*'warehouse\.\*'/);
  });

  it("adds MVP SKU templates, custom field grouping, and transactional enhanced create RPC", () => {
    const sql = readMvpMigration();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_sku_templates");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS section_name");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS help_text");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_create_enhanced_product");
    expect(sql).toContain("'warehouse.products.manage'");
  });
});
