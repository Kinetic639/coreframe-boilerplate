import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(__dirname, "../../../../supabase-target/supabase/migrations");
const phase2MigrationPath = path.join(
  migrationsDir,
  "20260506090000_inventory_phase2_enterprise_core.sql"
);

function readPhase2Migration() {
  return fs.readFileSync(phase2MigrationPath, "utf8");
}

function tableBlock(sql: string, tableName: string) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${escaped} \\(([\\s\\S]*?)\\n\\);`, "i")
  );
  if (!match) throw new Error(`Missing CREATE TABLE block for ${tableName}`);
  return match[1];
}

describe("Ambra Inventory V2 Phase 2 migration", () => {
  it("creates the required Phase 2 enterprise tables", () => {
    const sql = readPhase2Migration();
    for (const tableName of [
      "inventory_option_groups",
      "inventory_option_values",
      "inventory_variant_option_values",
      "inventory_lots",
      "inventory_serials",
      "inventory_reservations",
      "inventory_reservation_lines",
      "inventory_allocations",
      "inventory_allocation_lines",
      "inventory_suppliers",
      "inventory_purchase_orders",
      "inventory_purchase_order_lines",
      "inventory_variant_costs",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${tableName}`);
    }
  });

  it("keeps reservations and allocations outside movement kinds while changing availability", () => {
    const sql = readPhase2Migration();
    const reservationBlock = tableBlock(sql, "inventory_reservation_lines");
    const allocationBlock = tableBlock(sql, "inventory_allocation_lines");

    expect(reservationBlock).toContain("reserved_quantity");
    expect(allocationBlock).toContain("allocated_quantity");
    expect(sql).toContain("reserved_quantity = reserved_quantity + v_quantity");
    expect(sql).toContain("allocated_quantity = allocated_quantity + v_quantity");
    expect(sql).not.toContain("movement_kind in ('reservation'");
    expect(sql).not.toContain("movement_kind in ('allocation'");
  });

  it("adds lot and serial identity to movement lines and validates tracked products", () => {
    const sql = readPhase2Migration();

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS lot_id uuid null");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS serial_id uuid null");
    expect(sql).toContain("Lot-tracked products require lot_id in Phase 2 movements");
    expect(sql).toContain("Serialized products require serial_id in Phase 2 movements");
    expect(sql).toContain("inventory_validate_lot_serial_product");
  });

  it("supports purchase orders, partial receiving, and receipt movement creation", () => {
    const sql = readPhase2Migration();

    expect(sql).toContain("inventory_create_purchase_order");
    expect(sql).toContain("inventory_receive_purchase_order");
    expect(sql).toContain("'partially_received'");
    expect(sql).toContain("inventory_create_draft_movement");
    expect(sql).toContain("inventory_post_movement");
    expect(sql).toContain("'purchase_order'");
  });

  it("adds basic pricing and weighted-average cost tracking outside balances", () => {
    const sql = readPhase2Migration();
    const costBlock = tableBlock(sql, "inventory_variant_costs");

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS purchase_price");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS sales_price");
    expect(costBlock).toContain("average_unit_cost");
    expect(costBlock).toContain("total_quantity");
    expect(costBlock).toContain("total_value");
    expect(sql).toContain("inventory_update_weighted_average_cost");
    expect(sql).toContain("inventory_movement_weighted_average_cost");
  });

  it("uses exact Phase 2 permission slugs and recompiles permission snapshots", () => {
    const sql = readPhase2Migration();

    expect(sql).toContain("'warehouse.procurement.read'");
    expect(sql).toContain("'warehouse.procurement.manage'");
    expect(sql).toContain("'warehouse.pricing.read'");
    expect(sql).toContain("'warehouse.pricing.manage'");
    expect(sql).toContain("compile_user_permissions");
    expect(sql).not.toMatch(/has_(?:branch_)?permission\([^;]*'warehouse\.\*'/);
  });
});
