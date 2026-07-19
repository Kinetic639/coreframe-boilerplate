/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../../../supabase-target/supabase/migrations/20260718092756_harden_inventory_audit_status_and_supplier_scope.sql"
);

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

describe("Inventory audit status and supplier hardening migration", () => {
  it("adds a guarded helper that matches legacy suppliers and CRM item suppliers", () => {
    const sql = readMigration();

    expect(sql).toContain("inventory_variant_matches_audit_supplier");
    expect(sql).toContain("p_legacy_supplier_id = p_supplier_id");
    expect(sql).toContain("to_regclass('public.warehouse_item_suppliers')");
    expect(sql).toContain("FROM public.warehouse_item_suppliers wis");
    expect(sql).toContain("wis.item_id = $2");
    expect(sql).toContain("wis.party_id = $3");
  });

  it("recompiles supplier-scoped session creation through the supplier match helper", () => {
    const sql = readMigration();
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.inventory_create_count_session[\s\S]*?\n\$\$;/
    );

    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("public.inventory_variant_matches_audit_supplier(");
    expect(fnBody).toContain("v.default_supplier_id");
    expect(fnBody).not.toContain("AND v.default_supplier_id = v_supplier_id");
  });

  it("adds a session trigger that prevents reopening closed sessions and moving backwards", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.inventory_count_sessions_guard_status"
    );
    expect(sql).toContain("OLD.status IN ('approved', 'cancelled')");
    expect(sql).toContain("OLD.status = 'submitted' AND NEW.status = 'submitted'");
    expect(sql).toContain("CREATE TRIGGER inventory_count_sessions_guard_status_trigger");
    expect(sql).toContain("BEFORE UPDATE ON public.inventory_count_sessions");
  });

  it("enforces required approval reasons in the count-line trigger from session scope", () => {
    const sql = readMigration();

    expect(sql).toContain("SELECT id, status, scope");
    expect(sql).toContain("v_requires_reason");
    expect(sql).toContain("v_session.scope ->> 'require_reason_for_variance'");
    expect(sql).toContain("NEW.status = 'approved'");
    expect(sql).toContain("A reason is required to approve a line with a quantity variance");
  });
});
