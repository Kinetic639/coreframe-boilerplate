/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../../../supabase-target/supabase/migrations/20260716190424_harden_inventory_audit_delete_policies.sql"
);

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

describe("Inventory audit delete hardening migration", () => {
  it("replaces broad FOR ALL manage policies with explicit insert/update policies", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "DROP POLICY IF EXISTS inventory_count_sessions_manage ON public.inventory_count_sessions"
    );
    expect(sql).toContain(
      "DROP POLICY IF EXISTS inventory_count_lines_manage ON public.inventory_count_lines"
    );
    expect(sql).not.toMatch(/CREATE POLICY inventory_count_(sessions|lines)_manage[\s\S]*FOR ALL/);

    expect(sql).toContain("CREATE POLICY inventory_count_sessions_insert");
    expect(sql).toContain("ON public.inventory_count_sessions FOR INSERT");
    expect(sql).toContain("CREATE POLICY inventory_count_sessions_update");
    expect(sql).toContain("ON public.inventory_count_sessions FOR UPDATE");

    expect(sql).toContain("CREATE POLICY inventory_count_lines_insert");
    expect(sql).toContain("ON public.inventory_count_lines FOR INSERT");
    expect(sql).toContain("CREATE POLICY inventory_count_lines_update");
    expect(sql).toContain("ON public.inventory_count_lines FOR UPDATE");
  });

  it("explicitly denies hard deletes on stock-audit sessions and lines", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE POLICY inventory_count_sessions_delete_deny");
    expect(sql).toContain("ON public.inventory_count_sessions FOR DELETE");
    expect(sql).toContain("CREATE POLICY inventory_count_lines_delete_deny");
    expect(sql).toContain("ON public.inventory_count_lines FOR DELETE");

    const sessionsDeletePolicy = sql.match(
      /CREATE POLICY inventory_count_sessions_delete_deny[\s\S]*?;/
    )?.[0];
    const linesDeletePolicy = sql.match(
      /CREATE POLICY inventory_count_lines_delete_deny[\s\S]*?;/
    )?.[0];

    expect(sessionsDeletePolicy).toContain("USING (false)");
    expect(linesDeletePolicy).toContain("USING (false)");
  });
});
