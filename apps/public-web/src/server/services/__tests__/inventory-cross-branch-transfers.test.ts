import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPaths = [
  path.resolve(
    __dirname,
    "../../../../supabase-target/supabase/migrations/20260510090000_inventory_cross_branch_transfers.sql"
  ),
  path.resolve(
    __dirname,
    "../../../../supabase-target/supabase/migrations/20260521150000_inventory_branch_transfer_reservations.sql"
  ),
  path.resolve(
    __dirname,
    "../../../../supabase-target/supabase/migrations/20260521161000_inventory_branch_transfer_accept_definer.sql"
  ),
  path.resolve(
    __dirname,
    "../../../../supabase-target/supabase/migrations/20260523090000_inventory_movement_number_allocator.sql"
  ),
];

function readMigration() {
  return migrationPaths.map((migrationPath) => fs.readFileSync(migrationPath, "utf8")).join("\n");
}

describe("Ambra Inventory V2 cross-branch transfer migration", () => {
  it("creates branch transfer header and line tables", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_branch_transfers");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_branch_transfer_lines");
    expect(sql).toContain("source_branch_id uuid not null references public.branches");
    expect(sql).toContain("destination_branch_id uuid not null references public.branches");
    expect(sql).toContain("status in ('in_transit', 'accepted', 'declined')");
    expect(sql).toContain("source_location_id uuid not null references public.warehouse_locations");
    expect(sql).toContain(
      "destination_location_id uuid null references public.warehouse_locations"
    );
  });

  it("reserves source stock while in transit and posts movements only on accept", () => {
    const sql = readMigration();

    expect(sql).toContain("inventory_create_branch_transfer");
    expect(sql).toContain("inventory_accept_branch_transfer");
    expect(sql).toContain("inventory_decline_branch_transfer");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS reservation_id");
    expect(sql).toContain("inventory_create_reservation");
    expect(sql).toContain("inventory_release_reservation");
    expect(sql).toContain("'reservation_id', v_reservation_id");
    expect(sql).toContain("'issue'");
    expect(sql).toContain("'receipt'");
    expect(sql).toContain("'branch-transfer-send-'");
    expect(sql).toContain("'branch-transfer-accept-'");
    expect(sql).toContain("'source_movement_id', null");
    expect(sql).toContain("'branch-transfer-decline-'");
    expect(sql).toContain("inventory_create_draft_movement");
    expect(sql).toContain("inventory_post_movement");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("Accepting a cross-branch transfer is a destination-branch decision");
    expect(sql).toContain("inventory_allocate_movement_number");
    expect(sql).toContain("movement_number_next = greatest");
    expect(sql).toContain("return_movement_id = v_movement_id");
  });

  it("keeps transfer data behind branch-scoped inventory permissions", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "public.has_branch_permission(organization_id, source_branch_id, 'warehouse.inventory.read')"
    );
    expect(sql).toContain(
      "public.has_branch_permission(organization_id, destination_branch_id, 'warehouse.inventory.read')"
    );
    expect(sql).toContain(
      "public.has_branch_permission(organization_id, source_branch_id, 'warehouse.inventory.operate')"
    );
    expect(sql).toContain(
      "public.has_branch_permission(organization_id, destination_branch_id, 'warehouse.inventory.operate')"
    );
    expect(sql).toContain("ALTER TABLE public.inventory_branch_transfers FORCE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "ALTER TABLE public.inventory_branch_transfer_lines FORCE ROW LEVEL SECURITY"
    );
    expect(sql).not.toMatch(/has_(?:branch_)?permission\([^;]*'warehouse\.\*'/);
  });
});
