/**
 * RLS / DB RPC Permission Slug Invariant Tests  (CONTRACT TEST)
 *
 * Rule: RLS policies and DB RPC permission checks must only use non-wildcard permission slugs.
 *
 * Rationale:
 *   - DB functions `has_permission`, `has_branch_permission`, and `user_has_effective_permission`
 *     perform EXACT string matches against UEP.permission_slug.
 *   - UEP may contain wildcard rows like `"warehouse.*"` or `"module.*"` that are stored verbatim.
 *   - If an RLS policy used a wildcard slug (e.g. `has_permission(org_id, "warehouse.*")`), it
 *     would ONLY match a UEP row where permission_slug = "warehouse.*" exactly — it would NOT
 *     expand the wildcard to match all "warehouse.X" rows.
 *   - This would cause a silent security bypass or unexpected denial depending on direction.
 *
 * These tests assert that all slugs used in RLS gates and DB RPC calls are non-wildcard.
 *
 * ─── CONTRACT vs DB-BACKED ───────────────────────────────────────────────────
 * This is a CONTRACT TEST: it validates that the TypeScript constants bound to
 * RLS gate slugs do not contain wildcards, and that the known set is registered
 * in ALL_PERMISSION_SLUGS. It does NOT query the live DB.
 *
 * For a live DB introspection test (querying pg_policies via the service-role
 * audit function), see:
 *   src/server/services/__tests__/rls-wildcard-db-invariant.test.ts
 *
 * ─── FULL RLS SLUG INVENTORY (updated 2026-04-02 via Supabase MCP) ─────────
 * The following 12 permission slugs appear in RLS policy expressions across
 * the public schema tables (user_role_assignments, user_permission_overrides,
 * organization_members, branches, org_positions, org_profiles, invitations,
 * user_effective_permissions, warehouse_locations):
 *
 *   members.read, members.manage, branch.roles.manage,
 *   branches.create, branches.delete, branches.update,
 *   invites.create, invites.read, invites.cancel,
 *   org.update,
 *   warehouse.locations.read, warehouse.locations.manage
 *
 * None contain "*". This contract test verifies all 12.
 */
import { describe, it, expect } from "vitest";
import {
  // Core member/branch management
  MEMBERS_READ,
  MEMBERS_MANAGE,
  BRANCH_ROLES_MANAGE,
  // Branch CRUD
  BRANCHES_CREATE,
  BRANCHES_DELETE,
  BRANCHES_UPDATE,
  // Invitations
  INVITES_CREATE,
  INVITES_READ,
  INVITES_CANCEL,
  // Org profile
  ORG_UPDATE,
  // Warehouse locations
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_LOCATIONS_MANAGE,
  // Warehouse inventory phase 1
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_ARCHIVE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_ADJUST,
  WAREHOUSE_INVENTORY_REVERSE,
  WAREHOUSE_SETTINGS_MANAGE,
  WAREHOUSE_PROCUREMENT_READ,
  WAREHOUSE_PROCUREMENT_MANAGE,
  WAREHOUSE_PRICING_READ,
  WAREHOUSE_PRICING_MANAGE,
  WAREHOUSE_REPORTS_READ,
  WAREHOUSE_IMPORTS_MANAGE,
  // DB RPC gate slugs
  BRANCHES_VIEW_ANY,
  BRANCHES_VIEW_UPDATE_ANY,
  BRANCHES_VIEW_REMOVE_ANY,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  ALL_PERMISSION_SLUGS,
} from "../permissions";

/**
 * The COMPLETE list of permission slugs used in RLS policies (pg_policies).
 * Verified against the live DB on 2026-03-04 via regexp_matches on pg_policies.
 *
 * Source tables: user_role_assignments, user_permission_overrides, organization_members,
 * branches, org_positions, org_profiles, invitations, user_effective_permissions.
 */
const RLS_GATE_SLUGS = [
  MEMBERS_READ, // V2 org/branch URA SELECT policies; org_members UPDATE
  MEMBERS_MANAGE, // URA/UPO/roles INSERT/UPDATE/DELETE policies; org_members UPDATE
  BRANCH_ROLES_MANAGE, // V2 branch URA SELECT/INSERT/UPDATE/DELETE dual-gate
  BRANCHES_CREATE, // branches INSERT policy
  BRANCHES_DELETE, // branches DELETE policy
  BRANCHES_UPDATE, // branches UPDATE policy
  INVITES_CREATE, // invitations INSERT policy
  INVITES_READ, // invitations SELECT policy
  INVITES_CANCEL, // invitations UPDATE/DELETE (cancel) policy
  ORG_UPDATE, // org_positions / org_profiles UPDATE policy
  WAREHOUSE_LOCATIONS_READ, // warehouse_locations SELECT policy (wl_select_locations_read)
  WAREHOUSE_LOCATIONS_MANAGE, // warehouse_locations INSERT/UPDATE policies
  WAREHOUSE_PRODUCTS_READ, // inventory_products/inventory_variants SELECT policies
  WAREHOUSE_PRODUCTS_MANAGE, // inventory product/unit/reason INSERT/UPDATE policies
  WAREHOUSE_PRODUCTS_ARCHIVE, // inventory product archive action/RPC gate
  WAREHOUSE_INVENTORY_READ, // inventory balances/movements SELECT policies
  WAREHOUSE_INVENTORY_OPERATE, // movement creation/posting policies and RPC gates
  WAREHOUSE_INVENTORY_ADJUST, // adjustment movement RPC gate
  WAREHOUSE_INVENTORY_REVERSE, // reversal movement RPC gate
  WAREHOUSE_SETTINGS_MANAGE, // inventory_settings mutation policy/RPC gate
  WAREHOUSE_PROCUREMENT_READ, // Phase 2 procurement SELECT policies
  WAREHOUSE_PROCUREMENT_MANAGE, // Phase 2 procurement write/RPC gates
  WAREHOUSE_PRICING_READ, // Phase 2 pricing/cost SELECT policies
  WAREHOUSE_PRICING_MANAGE, // Phase 2 pricing/cost write policies
  WAREHOUSE_REPORTS_READ, // Phase 3 report, saved export, valuation snapshot policies
  WAREHOUSE_IMPORTS_MANAGE, // Phase 3 import/export job policies
] as const;

/**
 * Slugs used explicitly in checkOrgPermissionExact server action calls.
 * These go through DB RPC (exact match only) — must never be wildcards.
 */
const RPC_GATE_SLUGS = [
  BRANCHES_VIEW_ANY,
  BRANCHES_VIEW_UPDATE_ANY,
  BRANCHES_VIEW_REMOVE_ANY,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
] as const;

function isWildcard(slug: string): boolean {
  return slug.includes("*");
}

describe("RLS gate slugs — non-wildcard invariant (complete inventory)", () => {
  it("all RLS gate slugs are non-wildcard strings", () => {
    for (const slug of RLS_GATE_SLUGS) {
      expect(isWildcard(slug), `RLS gate slug "${slug}" must not contain "*"`).toBe(false);
    }
  });

  it("all DB RPC gate slugs are non-wildcard strings", () => {
    for (const slug of RPC_GATE_SLUGS) {
      expect(isWildcard(slug), `DB RPC gate slug "${slug}" must not contain "*"`).toBe(false);
    }
  });

  // ── Exact value assertions (catch accidental constant rename/typo) ──────────

  it("MEMBERS_READ is the exact slug used in V2 URA view policies", () => {
    expect(MEMBERS_READ).toBe("members.read");
  });

  it("MEMBERS_MANAGE is the exact slug used in URA/UPO write policies", () => {
    expect(MEMBERS_MANAGE).toBe("members.manage");
  });

  it("BRANCH_ROLES_MANAGE is the exact slug used in branch URA dual-gate policies", () => {
    expect(BRANCH_ROLES_MANAGE).toBe("branch.roles.manage");
  });

  it("BRANCHES_CREATE/DELETE/UPDATE are the exact slugs used in branches table policies", () => {
    expect(BRANCHES_CREATE).toBe("branches.create");
    expect(BRANCHES_DELETE).toBe("branches.delete");
    expect(BRANCHES_UPDATE).toBe("branches.update");
  });

  it("INVITES_CREATE/READ/CANCEL are the exact slugs used in invitations policies", () => {
    expect(INVITES_CREATE).toBe("invites.create");
    expect(INVITES_READ).toBe("invites.read");
    expect(INVITES_CANCEL).toBe("invites.cancel");
  });

  it("ORG_UPDATE is the exact slug used in org_positions/org_profiles UPDATE policies", () => {
    expect(ORG_UPDATE).toBe("org.update");
  });

  it("WAREHOUSE_LOCATIONS_READ is the exact slug used in wl_select_locations_read policy", () => {
    expect(WAREHOUSE_LOCATIONS_READ).toBe("warehouse.locations.read");
  });

  it("WAREHOUSE_LOCATIONS_MANAGE is the exact slug used in wl_insert_manage and wl_update_manage policies", () => {
    expect(WAREHOUSE_LOCATIONS_MANAGE).toBe("warehouse.locations.manage");
  });

  it("warehouse product inventory slugs match the Phase 1 plan", () => {
    expect(WAREHOUSE_PRODUCTS_READ).toBe("warehouse.products.read");
    expect(WAREHOUSE_PRODUCTS_MANAGE).toBe("warehouse.products.manage");
    expect(WAREHOUSE_PRODUCTS_ARCHIVE).toBe("warehouse.products.archive");
  });

  it("warehouse stock operation slugs match the Phase 1 plan", () => {
    expect(WAREHOUSE_INVENTORY_READ).toBe("warehouse.inventory.read");
    expect(WAREHOUSE_INVENTORY_OPERATE).toBe("warehouse.inventory.operate");
    expect(WAREHOUSE_INVENTORY_ADJUST).toBe("warehouse.inventory.adjust");
    expect(WAREHOUSE_INVENTORY_REVERSE).toBe("warehouse.inventory.reverse");
    expect(WAREHOUSE_SETTINGS_MANAGE).toBe("warehouse.settings.manage");
  });

  it("warehouse enterprise slugs match the Phase 2 plan", () => {
    expect(WAREHOUSE_PROCUREMENT_READ).toBe("warehouse.procurement.read");
    expect(WAREHOUSE_PROCUREMENT_MANAGE).toBe("warehouse.procurement.manage");
    expect(WAREHOUSE_PRICING_READ).toBe("warehouse.pricing.read");
    expect(WAREHOUSE_PRICING_MANAGE).toBe("warehouse.pricing.manage");
  });

  it("warehouse advanced slugs match the Phase 3 plan", () => {
    expect(WAREHOUSE_REPORTS_READ).toBe("warehouse.reports.read");
    expect(WAREHOUSE_IMPORTS_MANAGE).toBe("warehouse.imports.manage");
  });
});

describe("ALL_PERMISSION_SLUGS registry", () => {
  it("includes all RLS gate slugs and RPC gate slugs", () => {
    const allSlugs = ALL_PERMISSION_SLUGS as readonly string[];
    for (const slug of [...RLS_GATE_SLUGS, ...RPC_GATE_SLUGS]) {
      expect(allSlugs, `"${slug}" must be registered in ALL_PERMISSION_SLUGS`).toContain(slug);
    }
  });

  it("wildcard slugs in the registry are explicitly identified (not accidental)", () => {
    const wildcardSlugs = ALL_PERMISSION_SLUGS.filter(isWildcard);
    // Only expected wildcard slugs — if a new wildcard sneaks in, this test fails
    expect(wildcardSlugs.sort()).toEqual([
      "account.*",
      "module.*",
      "qr.*",
      "superadmin.*",
      "warehouse.*",
    ]);
  });

  it("wildcard slugs are NOT in any gate slug list", () => {
    const allGateSlugs = [...RLS_GATE_SLUGS, ...RPC_GATE_SLUGS];
    const wildcardGateSlugs = allGateSlugs.filter(isWildcard);
    expect(wildcardGateSlugs).toHaveLength(0);
  });
});
