/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../../../supabase-target/supabase/migrations/20260716215300_harden_inventory_audit_immutability.sql"
);

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

describe("Inventory audit immutability hardening migration", () => {
  it("adds a count-line trigger that rejects cross-session and closed-session mutations", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_count_lines_guard_session");
    expect(sql).toContain("OLD.count_session_id IS DISTINCT FROM NEW.count_session_id");
    expect(sql).toContain("organization_id = NEW.organization_id");
    expect(sql).toContain("branch_id = NEW.branch_id");
    expect(sql).toContain("v_session.status IN ('approved', 'cancelled')");
    expect(sql).toContain("CREATE TRIGGER inventory_count_lines_guard_session_trigger");
    expect(sql).toContain("BEFORE INSERT OR UPDATE ON public.inventory_count_lines");
  });

  it("recreates audit mutation policies as authenticated and workflow-aware", () => {
    const sql = readMigration();

    expect(sql).toMatch(/CREATE POLICY inventory_count_sessions_insert[\s\S]*TO authenticated/);
    expect(sql).toMatch(/CREATE POLICY inventory_count_sessions_update[\s\S]*TO authenticated/);
    expect(sql).toMatch(/CREATE POLICY inventory_count_lines_insert[\s\S]*TO authenticated/);
    expect(sql).toMatch(/CREATE POLICY inventory_count_lines_update[\s\S]*TO authenticated/);
    expect(sql).toMatch(/CREATE POLICY inventory_count_lines_delete_deny[\s\S]*TO authenticated/);
    expect(sql).toContain("s.status NOT IN ('approved', 'cancelled')");
    expect(sql).toContain("s.organization_id = inventory_count_lines.organization_id");
    expect(sql).toContain("s.branch_id = inventory_count_lines.branch_id");
  });

  it("wraps inventory_seed_movement_types behind an authenticated permission guard", () => {
    const sql = readMigration();

    expect(sql).toContain("RENAME TO inventory_seed_movement_types_internal");
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.inventory_seed_movement_types_internal(uuid, uuid)"
    );
    expect(sql).toContain("v_auth_uid uuid := (SELECT auth.uid())");
    expect(sql).toContain("p_actor_user_id <> v_auth_uid");
    expect(sql).toContain("'warehouse.inventory.adjust'");
    expect(sql).toContain(
      "PERFORM public.inventory_seed_movement_types_internal(p_organization_id, p_actor_user_id)"
    );
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.inventory_seed_movement_types(uuid, uuid)"
    );
    expect(sql).toContain("TO authenticated, service_role");
  });
});
