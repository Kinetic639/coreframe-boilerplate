/**
 * @vitest-environment node
 *
 * Regression test for the stock-audit migration
 * (supabase-target/supabase/migrations/20260701090000_inventory_audits_workflow.sql).
 *
 * Mirrors the pattern in inventory-phase3-migrations.test.ts: reads the raw
 * migration SQL and asserts on its content/invariants rather than executing
 * it against a live database. This proves the migration text itself upholds
 * the non-negotiable constraints from the implementation plan:
 *   - no direct UPDATE on inventory_balances anywhere in this file;
 *   - final posting still exclusively goes through the movement engine;
 *   - the count tables' RLS now gates on the new audit permission slugs;
 *   - inventory_variants' own RLS/ENABLE/FORCE state is untouched (only a
 *     plain ADD COLUMN);
 *   - the new inventory_reorder_suggestion_actions table has RLS enabled and
 *     forced from creation;
 *   - the new line-workflow columns/constraints and the default_supplier_id
 *     FK exist with the expected shape;
 *   - the expected supporting indexes exist.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(__dirname, "../../../../supabase-target/supabase/migrations");
const migrationPath = path.join(migrationsDir, "20260701090000_inventory_audits_workflow.sql");

function readMigration() {
  return fs.readFileSync(migrationPath, "utf8");
}

/** Strips `-- ...` line comments (keeping line breaks) so assertions about
 * actual SQL statements aren't tripped up by prose in comments that
 * legitimately mentions the same identifiers for documentation purposes. */
function stripLineComments(sql: string) {
  return sql.replace(/--.*$/gm, "");
}

describe("Stock audit migration (inventory_audits_workflow)", () => {
  it("never directly UPDATEs inventory_balances", () => {
    const sql = stripLineComments(readMigration());
    expect(sql).not.toContain("UPDATE public.inventory_balances");
    expect(sql.toUpperCase()).not.toMatch(/UPDATE\s+PUBLIC\.INVENTORY_BALANCES/);
  });

  it("keeps final posting on the movement-engine path", () => {
    const sql = readMigration();
    expect(sql).toContain("inventory_create_draft_movement(");
    expect(sql).toContain("inventory_post_movement(");
  });

  it("adds default_supplier_id to inventory_variants as a plain nullable FK, without touching that table's RLS", () => {
    const sql = readMigration();
    expect(sql).toContain(
      "ADD COLUMN IF NOT EXISTS default_supplier_id uuid NULL\n    REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;"
    );
    expect(sql).toContain("inventory_variants_default_supplier_idx");
    // No RLS/ENABLE/FORCE statement anywhere in this file references inventory_variants.
    expect(sql).not.toMatch(
      /ALTER TABLE public\.inventory_variants[\s\S]{0,80}(ROW LEVEL SECURITY|POLICY)/
    );
  });

  it("adds the inventory_count_lines workflow columns with the expected CHECK constraints", () => {
    const sql = readMigration();
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS reason_code text NULL");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'generated'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS sequence_no integer NULL");
    expect(sql).toContain(
      "CHECK (status IN ('pending', 'counted', 'skipped', 'needs_recount', 'approved'))"
    );
    expect(sql).toContain("CHECK (source IN ('generated', 'unexpected_found'))");
    expect(sql).toContain("inventory_count_lines_status_idx");
  });

  it("does not implement partial posting: no allow_partial_posting flag anywhere", () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/allow_partial_posting/i);
  });

  it("inventory_approve_count_session rejects posting while any line is pending, needs_recount, or an unapproved counted variance", () => {
    const sql = readMigration();
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.inventory_approve_count_session[\s\S]*?\n\$\$;/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];

    expect(fnBody).toContain("status = 'pending'");
    expect(fnBody).toContain("status = 'needs_recount'");
    expect(fnBody).toContain("status = 'counted' AND variance_quantity <> 0");
    // Zero-variance counted lines must NOT be treated as blocking — the guard
    // must always be qualified with "variance_quantity <> 0", never a bare
    // "status = 'counted'" rejection.
    expect(fnBody).not.toMatch(/status\s*=\s*'counted'\s*\)\s*THEN/);
    expect(fnBody).toContain("reason_code IS NULL");
    expect(fnBody).toContain("status = 'approved'");

    // Still independently requires warehouse.inventory.adjust (decision #3).
    expect(fnBody).toContain("'warehouse.inventory.adjust'");
    // Must never contain a direct balance UPDATE within this function body.
    expect(fnBody).not.toContain("UPDATE public.inventory_balances");
  });

  it("inventory_create_count_session is gated on warehouse.audits.manage, not warehouse.inventory.adjust", () => {
    const sql = readMigration();
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.inventory_create_count_session[\s\S]*?\n\$\$;/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("'warehouse.audits.manage'");
    expect(fnBody).not.toContain("'warehouse.inventory.adjust'");
  });

  it("adds a read-only inventory_count_session_list RPC gated on warehouse.audits.read", () => {
    const sql = readMigration();
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.inventory_count_session_list(");
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.inventory_count_session_list[\s\S]*?\n\$\$;/
    );
    expect(fnMatch![0]).toContain("'warehouse.audits.read'");
  });

  it("seeds the two new permission slugs and mirrors the existing read/adjust grant shape", () => {
    const sql = readMigration();
    expect(sql).toContain("'warehouse.audits.read'");
    expect(sql).toContain("'warehouse.audits.manage'");
    expect(sql).toContain("INSERT INTO public.permissions (slug, name, category, action)");
    // Only audits.read is explicitly granted to org_member, matching the
    // existing warehouse.inventory.read/.adjust asymmetry (org_owner covers
    // both via the warehouse.* wildcard only).
    const roleSeedMatch = sql.match(/DO \$\$\nDECLARE\n {2}v_member_id UUID;[\s\S]*?\nEND \$\$;/);
    expect(roleSeedMatch).toBeTruthy();
    const roleSeedCode = stripLineComments(roleSeedMatch![0]);
    expect(roleSeedCode).toContain("warehouse.audits.read");
    expect(roleSeedCode).not.toContain("warehouse.audits.manage");
  });

  it("swaps the RLS policies on inventory_count_sessions and inventory_count_lines to the new audit slugs, with separate read/manage policies", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "DROP POLICY IF EXISTS inventory_count_sessions_select ON public.inventory_count_sessions"
    );
    expect(sql).toContain(
      "DROP POLICY IF EXISTS inventory_count_sessions_adjust ON public.inventory_count_sessions"
    );
    expect(sql).toContain(
      "DROP POLICY IF EXISTS inventory_count_lines_select ON public.inventory_count_lines"
    );
    expect(sql).toContain(
      "DROP POLICY IF EXISTS inventory_count_lines_adjust ON public.inventory_count_lines"
    );

    const sessionsSelect = sql.match(/CREATE POLICY inventory_count_sessions_select[\s\S]*?;/)?.[0];
    const sessionsManage = sql.match(/CREATE POLICY inventory_count_sessions_manage[\s\S]*?;/)?.[0];
    const linesSelect = sql.match(/CREATE POLICY inventory_count_lines_select[\s\S]*?;/)?.[0];
    const linesManage = sql.match(/CREATE POLICY inventory_count_lines_manage[\s\S]*?;/)?.[0];

    expect(sessionsSelect).toContain("warehouse.audits.read");
    expect(sessionsManage).toContain("warehouse.audits.manage");
    expect(linesSelect).toContain("warehouse.audits.read");
    expect(linesManage).toContain("warehouse.audits.manage");

    // Read and manage must be separate policies, never collapsed into one.
    expect(sessionsSelect).not.toContain("warehouse.audits.manage");
    expect(linesSelect).not.toContain("warehouse.audits.manage");

    // No leftover references to the old slugs in the new policy definitions.
    expect(sessionsManage).not.toContain("warehouse.inventory.adjust");
    expect(linesManage).not.toContain("warehouse.inventory.adjust");
  });

  it("creates inventory_reorder_suggestion_actions with RLS enabled and forced from creation", () => {
    const sql = readMigration();
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_reorder_suggestion_actions");
    expect(sql).toContain(
      "ALTER TABLE public.inventory_reorder_suggestion_actions ENABLE ROW LEVEL SECURITY;"
    );
    expect(sql).toContain(
      "ALTER TABLE public.inventory_reorder_suggestion_actions FORCE ROW LEVEL SECURITY;"
    );
    expect(sql).toContain("CHECK (status IN ('accepted', 'ignored'))");
    expect(sql).toContain("inventory_reorder_suggestion_actions_lookup_idx");

    const selectPolicy = sql.match(
      /CREATE POLICY inventory_reorder_suggestion_actions_select[\s\S]*?;/
    )?.[0];
    const managePolicy = sql.match(
      /CREATE POLICY inventory_reorder_suggestion_actions_manage[\s\S]*?;/
    )?.[0];
    expect(selectPolicy).toContain("warehouse.audits.read");
    expect(managePolicy).toContain("warehouse.audits.manage");
  });

  it("recompiles permission snapshots for active org members at the end of the migration", () => {
    const sql = readMigration();
    expect(sql).toContain("compile_user_permissions(v_member.user_id, v_member.organization_id)");
  });
});
