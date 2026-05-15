import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(__dirname, "../../../../supabase-target/supabase/migrations");
const coreMigrationPath = path.join(migrationsDir, "20260505091000_inventory_phase1_core.sql");
const rpcMigrationPath = path.join(migrationsDir, "20260505092000_inventory_phase1_rpcs.sql");
const recompileMigrationPath = path.join(
  migrationsDir,
  "20260505093000_inventory_phase1_recompile_permissions.sql"
);

function readCoreMigration() {
  return fs.readFileSync(coreMigrationPath, "utf8");
}

function readRpcMigration() {
  return fs.readFileSync(rpcMigrationPath, "utf8");
}

function readRecompileMigration() {
  return fs.readFileSync(recompileMigrationPath, "utf8");
}

function tableBlock(sql: string, tableName: string) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${escaped} \\(([\\s\\S]*?)\\n\\);`, "i")
  );
  if (!match) throw new Error(`Missing CREATE TABLE block for ${tableName}`);
  return match[1];
}

describe("Ambra Inventory V2 Phase 1 core migration", () => {
  it("creates the required Phase 1 tables", () => {
    const sql = readCoreMigration();
    for (const tableName of [
      "inventory_settings",
      "inventory_units",
      "inventory_products",
      "inventory_variants",
      "inventory_movement_reasons",
      "inventory_movement_headers",
      "inventory_movement_lines",
      "inventory_balances",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${tableName}`);
    }
  });

  it("keeps stock identity on variant_id, not product_id, for balances and movement lines", () => {
    const sql = readCoreMigration();
    const balanceBlock = tableBlock(sql, "inventory_balances");
    const movementLineBlock = tableBlock(sql, "inventory_movement_lines");

    expect(balanceBlock).toContain("variant_id");
    expect(balanceBlock).not.toContain("product_id");
    expect(movementLineBlock).toContain("variant_id");
    expect(movementLineBlock).not.toContain("product_id");
  });

  it("keeps Phase 1 balances quantity-only", () => {
    const balanceBlock = tableBlock(readCoreMigration(), "inventory_balances");

    expect(balanceBlock).toContain("on_hand_quantity");
    expect(balanceBlock).toContain("reserved_quantity");
    expect(balanceBlock).toContain("allocated_quantity");
    expect(balanceBlock).toContain("available_quantity");
    expect(balanceBlock).not.toContain("average_unit_cost");
    expect(balanceBlock).not.toContain("total_value");
    expect(balanceBlock).not.toContain("currency");
  });

  it("restricts movement kinds to the Phase 1 stock-changing set", () => {
    const sql = readCoreMigration();

    for (const kind of ["receipt", "issue", "transfer", "adjustment", "opening_balance"]) {
      expect(sql).toContain(`'${kind}'`);
    }
    expect(sql).not.toContain("'reservation'");
    expect(sql).not.toContain("'allocation'");
  });

  it("requires SKU uniqueness per organization and one default variant per product", () => {
    const sql = readCoreMigration();

    expect(sql).toContain("inventory_variants_org_sku_active_uidx");
    expect(sql).toContain("ON public.inventory_variants (organization_id, lower(sku))");
    expect(sql).toContain("inventory_variants_default_per_product_uidx");
    expect(sql).toContain("WHERE is_default = true AND deleted_at IS NULL");
    expect(sql).toContain("inventory_products_default_variant_fk");
  });

  it("enforces the formal movement line validation matrix", () => {
    const sql = readCoreMigration();

    expect(sql).toContain("inventory_validate_movement_line");
    expect(sql).toContain("receipt', 'opening_balance");
    expect(sql).toContain("movements require destination_location_id only");
    expect(sql).toContain("issue movements require source_location_id only");
    expect(sql).toContain("transfer movements require source and destination locations");
    expect(sql).toContain("transfer source and destination must differ");
    expect(sql).toContain("adjustment increase requires destination_location_id only");
    expect(sql).toContain("adjustment decrease requires source_location_id only");
    expect(sql).toContain("adjustment direction is required");
  });

  it("blocks invalid Phase 1 stock entities and non-base units at the database boundary", () => {
    const sql = readCoreMigration();

    expect(sql).toContain("Service and bundle products cannot be used in Phase 1 stock movements");
    expect(sql).toContain("Only active variants can be used in movement lines");
    expect(sql).toContain("Phase 1 movement line unit must equal product base unit");
    expect(sql).toContain("inventory_movement_lines_quantity_positive check (quantity > 0)");
  });

  it("protects posted movement history and prevents direct balance writes", () => {
    const sql = readCoreMigration();

    expect(sql).toContain("inventory_protect_posted_movement_lines");
    expect(sql).toContain("Posted movement lines are immutable");
    expect(sql).toContain("inventory_protect_posted_movement_headers");
    expect(sql).toContain("Posted movement headers are immutable outside the movement engine");
    expect(sql).toContain("inventory_guard_balance_write");
    expect(sql).toContain("inventory_balances can only be changed by the movement engine");
  });

  it("enables and forces RLS on all Phase 1 tables", () => {
    const sql = readCoreMigration();
    for (const tableName of [
      "inventory_settings",
      "inventory_units",
      "inventory_products",
      "inventory_variants",
      "inventory_movement_reasons",
      "inventory_movement_headers",
      "inventory_movement_lines",
      "inventory_balances",
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE public.${tableName} FORCE ROW LEVEL SECURITY`);
    }
  });

  it("uses exact permission slugs and never gates RLS with warehouse wildcard", () => {
    const sql = readCoreMigration();

    expect(sql).toContain("'warehouse.products.read'");
    expect(sql).toContain("'warehouse.products.manage'");
    expect(sql).toContain("'warehouse.inventory.read'");
    expect(sql).toContain("'warehouse.inventory.operate'");
    expect(sql).toContain("'warehouse.inventory.adjust'");
    expect(sql).toContain("'warehouse.inventory.reverse'");
    expect(sql).toContain("'warehouse.settings.manage'");
    expect(sql).not.toMatch(/has_(?:branch_)?permission\([^;]*'warehouse\.\*'/);
  });
});

describe("Ambra Inventory V2 Phase 1 RPC migration", () => {
  it("defines the required transactional RPCs", () => {
    const sql = readRpcMigration();

    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.inventory_create_product_with_default_variant"
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_create_draft_movement");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_post_movement");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_reverse_movement");
  });

  it("uses movement-engine transaction state for protected balance and sequence writes", () => {
    const sql = readRpcMigration();

    expect(sql).toContain("set_config('ambra.inventory_movement_engine', 'on', true)");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("movement_number_next");
    expect(sql).toContain("sku_next");
  });

  it("keeps movement line stock identity variant-only inside RPCs", () => {
    const sql = readRpcMigration();
    const movementLineInserts =
      sql.match(/INSERT INTO public\.inventory_movement_lines[\s\S]*?\);/g) ?? [];

    expect(movementLineInserts.length).toBeGreaterThan(0);
    for (const insert of movementLineInserts) {
      expect(insert).toContain("variant_id");
      expect(insert).not.toContain("product_id");
    }
  });

  it("enforces Phase 1 posting rules in the movement engine", () => {
    const sql = readRpcMigration();

    expect(sql).toContain("available_quantity");
    expect(sql).toContain("allow_negative_stock");
    expect(sql).toContain("adjustment_direction");
    expect(sql).toContain("unit_id <> v_product_base_unit_id");
    expect(sql).toContain("status <> 'draft'");
    expect(sql).toContain("idempotency_key");
  });

  it("creates products through one default variant and server-side SKU generation", () => {
    const sql = readRpcMigration();

    expect(sql).toContain("inventory_create_product_with_default_variant");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("sku_next = sku_next + 1");
    expect(sql).toContain("INSERT INTO public.inventory_products");
    expect(sql).toContain("INSERT INTO public.inventory_variants");
    expect(sql).toContain("is_default");
    expect(sql).toContain("UPDATE public.inventory_products");
    expect(sql).toContain("default_variant_id = v_variant_id");
  });

  it("uses available stock checks for normal issue, transfer, and decrease adjustment", () => {
    const sql = readRpcMigration();

    expect(sql).toContain("v_header.movement_kind = 'issue'");
    expect(sql).toContain("v_header.movement_kind = 'transfer'");
    expect(sql).toContain("v_header.adjustment_direction = 'decrease'");
    expect(sql).toContain("v_balance.available_quantity < v_delta");
    expect(sql).toContain("v_balance.available_quantity < v_line.quantity");
    expect(sql).toContain("Insufficient available stock");
  });

  it("creates and locks missing balance rows through the movement engine", () => {
    const sql = readRpcMigration();

    expect(sql).toContain("inventory_get_or_create_balance_for_update");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("DO NOTHING");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("Unable to lock inventory balance row");
  });

  it("implements reversal through an opposite movement, not direct balance edits", () => {
    const sql = readRpcMigration();

    expect(sql).toContain("original_movement_id");
    expect(sql).toContain("reversal_movement_id");
    expect(sql).toContain("inventory_post_movement");
    expect(sql).not.toContain("DELETE FROM public.inventory_balances");
  });
});

describe("Ambra Inventory V2 Phase 1 permission refresh migration", () => {
  it("recompiles active member permission snapshots after adding inventory slugs", () => {
    const sql = readRecompileMigration();

    expect(sql).toContain("compile_user_permissions");
    expect(sql).toContain("organization_members");
    expect(sql).toContain("status = 'active'");
  });
});
