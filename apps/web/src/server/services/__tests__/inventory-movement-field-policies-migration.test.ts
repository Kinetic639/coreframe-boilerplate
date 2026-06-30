import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  __dirname,
  "../../../../supabase-target/supabase/migrations/20260626150000_inventory_movement_field_policies.sql"
);

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

describe("inventory movement field policy migration", () => {
  it("creates movement-owned field definition and type policy tables", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_movement_field_definitions");
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.inventory_movement_type_field_policies"
    );
    expect(sql).toContain("field_key text NOT NULL");
    expect(sql).toContain("policy text NOT NULL CHECK");
  });

  it("adds sender and recipient columns using nadawca/odbiorca naming", () => {
    const sql = readMigration();

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS sender_name");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS sender_details");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS recipient_name");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS recipient_details");
    expect(sql).toContain("equivalent to Polish nadawca");
    expect(sql).toContain("equivalent to Polish odbiorca");
  });

  it("seeds canonical fields and policies for PZ 101 and MM 801", () => {
    const sql = readMigration();

    for (const fieldKey of [
      "header.sender_name",
      "header.recipient_name",
      "line.variant_id",
      "line.unit_id",
      "line.quantity",
      "line.source_location_id",
      "line.destination_location_id",
    ]) {
      expect(sql).toContain(fieldKey);
    }

    expect(sql).toContain("mt.code = '101'");
    expect(sql).toContain("mt.code = '801'");
    expect(sql).toContain("mt.requires_source_location");
    expect(sql).toContain("mt.requires_destination_location");
  });

  it("enables forced RLS and exact warehouse permissions", () => {
    const sql = readMigration();

    for (const tableName of [
      "inventory_movement_field_definitions",
      "inventory_movement_type_field_policies",
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE public.${tableName} FORCE ROW LEVEL SECURITY`);
    }

    expect(sql).toContain("'warehouse.inventory.read'");
    expect(sql).toContain("'warehouse.inventory.operate'");
    expect(sql).toContain("'warehouse.imports.manage'");
    expect(sql).not.toMatch(/warehouse\.\*/);
  });

  it("adds indexes for policy and resolver lookups", () => {
    const sql = readMigration();

    expect(sql).toContain("inventory_movement_field_definitions_org_key_active_uidx");
    expect(sql).toContain("inventory_movement_field_definitions_org_scope_idx");
    expect(sql).toContain("inventory_movement_type_field_policies_type_key_active_uidx");
    expect(sql).toContain("inventory_movement_type_field_policies_org_code_idx");
  });
});
