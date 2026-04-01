/**
 * @vitest-environment node
 *
 * T-RLS-WILDCARD: DB-backed RLS permission gate wildcard invariant test.
 *
 * Verifies — against the live database — that no RLS policy expression
 * uses a wildcard (`"*"`) as the permission slug argument to
 * `has_permission`, `has_branch_permission`, or
 * `user_has_effective_permission`.
 *
 * Why wildcards in RLS are dangerous:
 *   DB functions `has_permission` and `has_branch_permission` perform an
 *   EXACT string match against `user_effective_permissions.permission_slug`.
 *   UEP stores wildcard rows verbatim (e.g. `"module.*"`). A policy using
 *   `has_permission(org_id, 'module.*')` would ONLY match a user who has a
 *   UEP row with slug = `"module.*"` literally — not any `"module.X"` slug —
 *   causing silent access denial or, worse, unintended elevation depending
 *   on how the UEP row was populated.
 *
 * Mechanism:
 *   Calls `public.audit_rls_permission_gate_slugs()` (service-role only),
 *   a SECURITY DEFINER function (migration 20260304120000) that introspects
 *   `pg_policies` and returns all string literals extracted from relevant
 *   policy expressions.
 *
 * Requirements (loaded from .env.local by Vitest/Vite):
 *   NEXT_PUBLIC_SUPABASE_URL       — project URL
 *   SUPABASE_SERVICE_ROLE_KEY      — service role key (bypasses RLS, can call audit fn)
 *
 * Tests skip automatically when env vars are absent (CI-safe).
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────────
 * This test requires migration 20260304120000_add_audit_rls_permission_gate_slugs_fn.sql
 * to be applied to the target Supabase project before it will pass.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";

// ─── Env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const HAVE_ENV = Boolean(SUPABASE_URL) && Boolean(SUPABASE_SERVICE_KEY);

const itIfEnv = HAVE_ENV ? it : it.skip;

// ─── Audit function result type ───────────────────────────────────────────────

interface AuditRow {
  /** String literal extracted from the policy expression */
  slug: string;
  /** Name of the RLS policy containing the expression */
  policy_name: string;
  /** Table the policy is on */
  table_name: string;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("T-RLS-WILDCARD: RLS permission gate wildcard invariant (DB-backed)", () => {
  itIfEnv(
    "no string literal in any has_permission / has_branch_permission RLS expression contains '*'",
    async () => {
      const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await client.rpc("audit_rls_permission_gate_slugs");

      // Function must exist and be callable with service_role
      expect(error, `audit_rls_permission_gate_slugs() RPC failed: ${error?.message}`).toBeNull();

      const rows: AuditRow[] = data ?? [];

      // Must return at least the known RLS slugs (sanity check that the function is working)
      expect(
        rows.length,
        "Expected at least 1 policy expression slug from pg_policies"
      ).toBeGreaterThan(0);

      // Core invariant: no extracted string literal contains '*'
      const wildcardsFound = rows.filter((r) => r.slug.includes("*"));

      expect(
        wildcardsFound,
        `Wildcard(s) found in RLS permission gate expressions:\n${wildcardsFound
          .map((r) => `  table=${r.table_name} policy=${r.policy_name} slug="${r.slug}"`)
          .join("\n")}`
      ).toHaveLength(0);
    }
  );

  itIfEnv(
    "audit function returns all expected concrete RLS gate slugs (sanity check)",
    async () => {
      const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await client.rpc("audit_rls_permission_gate_slugs");

      expect(error).toBeNull();

      const slugSet = new Set<string>((data ?? []).map((r: AuditRow) => r.slug));

      // These 10 slugs were verified as present in RLS policies on 2026-03-04.
      // If any disappears it means a policy was changed — investigate.
      const expectedRlsSlugs = [
        "members.read",
        "members.manage",
        "branch.roles.manage",
        "branches.create",
        "branches.delete",
        "branches.update",
        "invites.create",
        "invites.read",
        "invites.cancel",
        "org.update",
      ];

      for (const slug of expectedRlsSlugs) {
        expect(slugSet, `Expected RLS gate slug "${slug}" not found in audit results`).toContain(
          slug
        );
      }
    }
  );
});
