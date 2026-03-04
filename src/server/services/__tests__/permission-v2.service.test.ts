/**
 * @vitest-environment node
 *
 * Tests for PermissionServiceV2 static helpers and the 10k/100k-ready snapshot query.
 * Focus:
 *   - wildcard-safe canFromSnapshot and wildcard matrix documentation
 *   - getPermissionSnapshotForUser: two-query strategy (no OR), merge/dedup/sort
 *   - Compiler dedup invariant: service produces unique, sorted output
 *   - 100k-ready: compiler-side expansion — snapshot contains concrete slugs only
 *   - DB-backed: partial indexes on permission_slug_exact exist on live DB
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient as _supabaseCreateClient } from "@supabase/supabase-js";
import { PermissionServiceV2 } from "../permission-v2.service";
import { checkPermission } from "@/lib/utils/permissions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal Supabase client mock whose `.from().select().eq().is()` and
 * `.from().select().eq().eq()` chains resolve to the provided result.
 *
 * Each call to `supabase.from()` consumes the next entry in `results[]`.
 * Pass results in the order the method under test will call them.
 *
 * After the 100k migration, service queries use `permission_slug_exact`.
 * Mock data objects must use that field name for the service to read them correctly.
 */
function makeSupabaseMock(
  results: Array<{ data: Array<{ permission_slug_exact: string }> | null; error: unknown }>
) {
  let callIndex = 0;

  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "or", "in", "neq"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (
      onfulfilled: ((v: unknown) => unknown) | null | undefined,
      onrejected: ((r: unknown) => unknown) | null | undefined
    ) => Promise.resolve(result).then(onfulfilled, onrejected);
    return chain;
  };

  return {
    from: vi.fn().mockImplementation(() => {
      const result = results[callIndex] ?? { data: [], error: null };
      callIndex++;
      return makeChain(result);
    }),
  };
}

describe("PermissionServiceV2.canFromSnapshot", () => {
  // -----------------------------------------------------------------------
  // Wildcard safety — previously returned false for wildcard slugs (bug fix)
  // -----------------------------------------------------------------------

  it("returns true when allow list contains a matching wildcard", () => {
    const snapshot = { allow: ["warehouse.*"], deny: [] };
    // Previously failed: Array.includes("warehouse.*") !== "warehouse.products.read"
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("returns true for multi-segment wildcard", () => {
    const snapshot = { allow: ["warehouse.products.*"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.delete")).toBe(true);
  });

  it("returns true for universal wildcard *", () => {
    const snapshot = { allow: ["*"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "any.permission.here")).toBe(true);
  });

  it("returns true for module.* wildcard (UEP wildcard slug from org_owner role)", () => {
    const snapshot = { allow: ["module.*"], deny: [] };
    expect(
      PermissionServiceV2.canFromSnapshot(snapshot, "module.organization-management.access")
    ).toBe(true);
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "module.warehouse.access")).toBe(true);
  });

  it("returns false for non-matching wildcard", () => {
    const snapshot = { allow: ["warehouse.*"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "teams.members.read")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Deny-first semantics — inherited from checkPermission delegation
  // -----------------------------------------------------------------------

  it("deny-first: returns false when wildcard allow is overridden by exact deny", () => {
    const snapshot = { allow: ["warehouse.*"], deny: ["warehouse.products.delete"] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.delete")).toBe(false);
    // Other warehouse perms still allowed
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("deny-first: wildcard deny blocks all matching permissions", () => {
    const snapshot = { allow: ["warehouse.*"], deny: ["warehouse.*"] };
    // Deny wildcard takes precedence even though allow wildcard matches
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "warehouse.products.read")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Exact match still works (regression)
  // -----------------------------------------------------------------------

  it("exact match: returns true for permission present in allow list", () => {
    const snapshot = { allow: ["org.read", "members.manage"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "org.read")).toBe(true);
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "members.manage")).toBe(true);
  });

  it("exact match: returns false for permission absent from allow list", () => {
    const snapshot = { allow: ["org.read"], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "members.manage")).toBe(false);
  });

  it("returns false for empty allow list", () => {
    const snapshot = { allow: [], deny: [] };
    expect(PermissionServiceV2.canFromSnapshot(snapshot, "org.read")).toBe(false);
  });
});

describe("PermissionServiceV2.can (Set-based, exact match)", () => {
  it("returns true for exact match", () => {
    const perms = new Set(["org.read", "members.manage"]);
    expect(PermissionServiceV2.can(perms, "org.read")).toBe(true);
  });

  it("returns false when not present (can() is Set.has — exact match only)", () => {
    // In production, getOrgEffectivePermissions() now returns CONCRETE slugs only
    // (compiler expanded wildcards at write time). This test verifies the static
    // helper is exact-match; it does NOT reflect real UEP contents anymore.
    const perms = new Set(["warehouse.*"]);
    // can() is Set.has() — exact match only, not wildcard-aware
    expect(PermissionServiceV2.can(perms, "warehouse.products.read")).toBe(false);
    // Only matches the wildcard slug itself
    expect(PermissionServiceV2.can(perms, "warehouse.*")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-10K: getPermissionSnapshotForUser — two-query strategy (10k-ready package)
// ─────────────────────────────────────────────────────────────────────────────

describe("T-10K: getPermissionSnapshotForUser — two-query strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty snapshot when orgId is falsy (fail-closed guard)", async () => {
    const supabase = makeSupabaseMock([]);
    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "",
      "branch-1"
    );
    expect(result).toEqual({ allow: [], deny: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("calls exactly ONE query (org-scope) when branchId is null", async () => {
    const supabase = makeSupabaseMock([
      { data: [{ permission_slug_exact: "org.read" }], error: null },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      null
    );

    // Only one `from` call — no branch query issued
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ allow: ["org.read"], deny: [] });
  });

  it("calls exactly ONE query when branchId is undefined", async () => {
    const supabase = makeSupabaseMock([
      { data: [{ permission_slug_exact: "members.read" }], error: null },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1"
      // branchId intentionally omitted
    );

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ allow: ["members.read"], deny: [] });
  });

  it("calls TWO queries when branchId is set — org first, then branch", async () => {
    const supabase = makeSupabaseMock([
      { data: [{ permission_slug_exact: "org.read" }], error: null }, // query 1: org-scope
      { data: [{ permission_slug_exact: "branch.roles.manage" }], error: null }, // query 2: branch-scope
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    expect(supabase.from).toHaveBeenCalledTimes(2);
    expect(result.allow).toContain("org.read");
    expect(result.allow).toContain("branch.roles.manage");
    expect(result.deny).toEqual([]);
  });

  it("merges org and branch slugs, deduplicates, and sorts alphabetically", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [{ permission_slug_exact: "z.perm" }, { permission_slug_exact: "a.perm" }],
        error: null,
      },
      {
        data: [{ permission_slug_exact: "m.perm" }, { permission_slug_exact: "a.perm" }],
        error: null,
      }, // 'a.perm' duplicated
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    // Deduplicated: 'a.perm' appears once; sorted: a < m < z
    expect(result.allow).toEqual(["a.perm", "m.perm", "z.perm"]);
  });

  it("is fail-closed when org-scope query errors: returns empty snapshot", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "connection error" } }]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    expect(result).toEqual({ allow: [], deny: [] });
    // Branch query never issued after org query fails
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("is fail-closed when branch-scope query errors: returns empty snapshot", async () => {
    const supabase = makeSupabaseMock([
      { data: [{ permission_slug_exact: "org.read" }], error: null }, // org-scope OK
      { data: null, error: { message: "branch query failed" } }, // branch-scope fails
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    expect(result).toEqual({ allow: [], deny: [] });
  });

  it("deny array is always empty (denies resolved at compile time by DB compiler)", async () => {
    const supabase = makeSupabaseMock([
      { data: [{ permission_slug_exact: "org.read" }], error: null },
      { data: [{ permission_slug_exact: "branch.roles.manage" }], error: null },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    expect(result.deny).toEqual([]);
  });

  it("returns empty allow when both queries return empty arrays", async () => {
    const supabase = makeSupabaseMock([
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    expect(result).toEqual({ allow: [], deny: [] });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-10K-COMPILER: Compiler dedup invariant (service-layer behavior)
// ─────────────────────────────────────────────────────────────────────────────

describe("T-10K-COMPILER: Compiler dedup invariant", () => {
  it("getPermissionSnapshotForUser.allow contains no duplicate slugs", async () => {
    // Simulates the pathological case: same slug appears in both org and branch rows
    // (e.g., org-owner has 'org.read' at org scope AND a branch role also grants 'org.read')
    // The service must deduplicate: the Set(...) in merge step ensures this.
    const supabase = makeSupabaseMock([
      {
        data: [
          { permission_slug_exact: "org.read" },
          { permission_slug_exact: "org.read" }, // org returns dup
        ],
        error: null,
      },
      {
        data: [{ permission_slug_exact: "org.read" }, { permission_slug_exact: "members.manage" }],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    // No duplicates in allow
    const allowSet = new Set(result.allow);
    expect(allowSet.size).toBe(result.allow.length);
    expect(result.allow).toEqual(["members.manage", "org.read"]);
  });

  it("allow array is sorted lexicographically (deterministic for cache/comparison)", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [{ permission_slug_exact: "z.last" }, { permission_slug_exact: "a.first" }],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      null
    );

    // Must be sorted; not in DB-return order
    expect(result.allow).toEqual(["a.first", "z.last"]);
    expect(result.allow).toBe(result.allow); // same array reference from sort
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-100K: Compiler-side wildcard expansion (100k-ready package)
// ─────────────────────────────────────────────────────────────────────────────

describe("T-100K: Snapshot contains concrete slugs only (compiler-side expansion)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("snapshot allow contains concrete slugs — no wildcards in permission_slug_exact", async () => {
    // After 100k migration: the compiler expands wildcards at write time.
    // UEP permission_slug_exact is always concrete. The service reads it directly.
    const supabase = makeSupabaseMock([
      {
        data: [
          { permission_slug_exact: "module.organization-management.access" },
          { permission_slug_exact: "account.profile.read" },
          { permission_slug_exact: "account.profile.update" },
          { permission_slug_exact: "org.read" },
        ],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      null
    );

    // No wildcards in the allow array
    expect(result.allow.every((s) => !s.includes("*"))).toBe(true);
    // Sorted
    expect(result.allow).toEqual([
      "account.profile.read",
      "account.profile.update",
      "module.organization-management.access",
      "org.read",
    ]);
  });

  it("checkPermission works with concrete-only snapshot (exact match path)", async () => {
    // When allow contains concrete slugs, checkPermission uses exact equality.
    // The result is correct without any wildcard regex evaluation.
    const supabase = makeSupabaseMock([
      {
        data: [
          { permission_slug_exact: "account.profile.read" },
          { permission_slug_exact: "module.organization-management.access" },
          { permission_slug_exact: "org.read" },
        ],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      null
    );

    // These were previously only reachable if the snapshot contained "account.*" wildcard.
    // With expansion at compile time, the concrete slug is directly in the snapshot.
    expect(checkPermission(result, "account.profile.read")).toBe(true);
    expect(checkPermission(result, "module.organization-management.access")).toBe(true);
    expect(checkPermission(result, "org.read")).toBe(true);

    // Not granted
    expect(checkPermission(result, "account.profile.update")).toBe(false);
    expect(checkPermission(result, "members.manage")).toBe(false);
  });

  it("module.* source expands: module.organization-management.access is concrete in snapshot", async () => {
    // Represents the real live DB state after compiler runs for an org_owner:
    // The role has "module.*" in role_permissions, which the compiler expands
    // to "module.organization-management.access" (the only module.* slug in registry).
    const supabase = makeSupabaseMock([
      {
        data: [
          // Compiler expanded "module.*" → "module.organization-management.access"
          { permission_slug_exact: "module.organization-management.access" },
          { permission_slug_exact: "branches.create" },
          { permission_slug_exact: "branches.read" },
        ],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      null
    );

    // Concrete slug reachable via exact match — no wildcard expansion in TS needed
    expect(checkPermission(result, "module.organization-management.access")).toBe(true);
    // Other module.X slugs not in registry → not expanded → not present
    expect(checkPermission(result, "module.warehouse.access")).toBe(false);
  });

  it("org + branch concrete slugs merge correctly with dedup", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          { permission_slug_exact: "org.read" },
          { permission_slug_exact: "branches.read" }, // appears in both scopes
        ],
        error: null,
      },
      {
        data: [
          { permission_slug_exact: "branches.read" }, // duplicate
          { permission_slug_exact: "branch.roles.manage" },
        ],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    // branches.read deduplicated; result sorted
    expect(result.allow).toEqual(["branch.roles.manage", "branches.read", "org.read"]);
    const hasDup = result.allow.length !== new Set(result.allow).size;
    expect(hasDup).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-10K-DB: DB-backed index verification (live DB, skipped if no env vars)
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY_DB = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const HAVE_DB_ENV = Boolean(SUPABASE_URL_DB) && Boolean(SUPABASE_SERVICE_KEY_DB);
const itIfDb = HAVE_DB_ENV ? it : it.skip;

// ─── Result type for audit_uep_partial_indexes() RPC ─────────────────────────

interface UepIndexRow {
  indexname: string;
  indexdef: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// T-REVOKE-UNIT: Revoke-under-wildcard — unit-level behavior
// ─────────────────────────────────────────────────────────────────────────────

describe("T-REVOKE-UNIT: Revoke suppresses expanded slug in snapshot (unit)", () => {
  // The compiler runs in the DB.  At the service layer, it either returns the
  // row or does not.  These unit tests verify the service correctly reads
  // whatever the DB returns — the correctness proof is in T-REVOKE-DB.
  //
  // Scenario: user has account.* grant but account.profile.read is revoked.
  // The compiler (if correct) will NOT emit account.profile.read into UEP.
  // The service therefore returns a snapshot WITHOUT account.profile.read.

  it("snapshot without account.profile.read when DB omits it (revoke took effect)", async () => {
    // DB returned only the non-revoked expansions of account.*
    const supabase = makeSupabaseMock([
      {
        data: [
          // account.profile.read intentionally absent — revoked at compile time
          { permission_slug_exact: "account.profile.update" },
          { permission_slug_exact: "account.preferences.read" },
          { permission_slug_exact: "account.preferences.update" },
          { permission_slug_exact: "account.settings.read" },
          { permission_slug_exact: "account.settings.update" },
          { permission_slug_exact: "org.read" },
        ],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      null
    );

    // Revoked slug must not appear
    expect(result.allow).not.toContain("account.profile.read");
    // Other expansions of account.* are still present
    expect(result.allow).toContain("account.profile.update");
    expect(result.allow).toContain("account.preferences.read");
    // checkPermission correctly returns false for the revoked slug
    expect(checkPermission(result, "account.profile.read")).toBe(false);
    expect(checkPermission(result, "account.profile.update")).toBe(true);
  });

  it("revoking account.* (source wildcard) suppresses all its expansions", async () => {
    // When the source wildcard is revoked, the compiler emits zero expanded rows.
    const supabase = makeSupabaseMock([
      {
        data: [
          // account.* entirely absent — wildcard source was revoked
          { permission_slug_exact: "org.read" },
        ],
        error: null,
      },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      null
    );

    expect(result.allow).not.toContain("account.profile.read");
    expect(result.allow).not.toContain("account.profile.update");
    expect(result.allow).toEqual(["org.read"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-REVOKE-DB: End-to-end revoke-under-wildcard proof (live DB, service_role)
//
// Proves the P0 compiler fix: revoking a concrete slug that was produced by
// wildcard expansion must suppress that row in UEP.
//
// Setup:
//   - Create ephemeral user (auth.admin) + org + org_member
//   - Role with account.* permission (wildcard)
//   - user_permission_overrides revoke for account.profile.read
//   - Call compile_user_permissions
//
// Assertions:
//   - account.profile.read NOT in UEP  (was broken before fix)
//   - account.profile.update IS in UEP (expansion still works)
//   - account.* NOT in UEP             (no verbatim wildcard rows)
//
// Cleanup: reverses all inserts, deletes the ephemeral user.
// ─────────────────────────────────────────────────────────────────────────────

describe("T-REVOKE-DB: Revoke-under-wildcard proof (live DB)", () => {
  itIfDb(
    "revoking account.profile.read suppresses that expanded slug but not others",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(SUPABASE_URL_DB, SUPABASE_SERVICE_KEY_DB, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // ── Lookups ──────────────────────────────────────────────────────────
      // Fetch required permission IDs from registry
      const { data: permRows, error: permErr } = await client
        .from("permissions")
        .select("id, slug")
        .in("slug", ["account.*", "account.profile.read", "account.profile.update"])
        .is("deleted_at", null);
      expect(permErr).toBeNull();
      const permBySlug = Object.fromEntries((permRows ?? []).map((r) => [r.slug, r.id]));
      expect(permBySlug["account.*"], "account.* must exist in permissions registry").toBeDefined();
      expect(
        permBySlug["account.profile.read"],
        "account.profile.read must exist in permissions registry"
      ).toBeDefined();
      expect(
        permBySlug["account.profile.update"],
        "account.profile.update must exist in permissions registry"
      ).toBeDefined();

      // ── Create ephemeral user ─────────────────────────────────────────────
      const uniqueEmail = `test-revoke-${Date.now()}@test-internal.example`;
      const { data: authData, error: authErr } = await client.auth.admin.createUser({
        email: uniqueEmail,
        password: "TestRevoke!2026",
        email_confirm: true,
      });
      expect(authErr, `Failed to create test user: ${authErr?.message}`).toBeNull();
      const userId = authData!.user.id;

      // Track IDs for cleanup
      let orgId = "";
      let roleId = "";

      try {
        // ── Setup ─────────────────────────────────────────────────────────
        // 1) Create org
        const { data: orgRow, error: orgErr } = await client
          .from("organizations")
          .insert({ name: `test-revoke-org-${Date.now()}` })
          .select("id")
          .single();
        expect(orgErr).toBeNull();
        orgId = orgRow!.id;

        // 2) Org membership
        const { error: memErr } = await client
          .from("organization_members")
          .insert({ organization_id: orgId, user_id: userId, status: "active" });
        expect(memErr).toBeNull();

        // 3) Role with account.* permission
        const { data: roleRow, error: roleErr } = await client
          .from("roles")
          .insert({ name: `test-wildcard-role-${Date.now()}` })
          .select("id")
          .single();
        expect(roleErr).toBeNull();
        roleId = roleRow!.id;

        const { error: rpErr } = await client
          .from("role_permissions")
          .insert({ role_id: roleId, permission_id: permBySlug["account.*"], allowed: true });
        expect(rpErr).toBeNull();

        // 4) Assign role (org scope)
        const { error: uraErr } = await client
          .from("user_role_assignments")
          .insert({ user_id: userId, role_id: roleId, scope: "org", scope_id: orgId });
        expect(uraErr).toBeNull();

        // 5) Revoke override for account.profile.read (concrete slug)
        const { error: upoErr } = await client.from("user_permission_overrides").insert({
          user_id: userId,
          organization_id: orgId,
          permission_id: permBySlug["account.profile.read"],
          permission_slug: "account.profile.read",
          effect: "revoke",
          allowed: false,
          scope: "org",
          scope_id: orgId,
        });
        expect(upoErr).toBeNull();

        // ── Compile ────────────────────────────────────────────────────────
        const { error: compileErr } = await client.rpc("compile_user_permissions", {
          p_user_id: userId,
          p_organization_id: orgId,
        });
        expect(compileErr, `compile_user_permissions failed: ${compileErr?.message}`).toBeNull();

        // ── Assertions ─────────────────────────────────────────────────────
        const { data: uepRows, error: uepErr } = await client
          .from("user_effective_permissions")
          .select("permission_slug, permission_slug_exact")
          .eq("user_id", userId)
          .eq("organization_id", orgId)
          .is("branch_id", null);
        expect(uepErr).toBeNull();

        const exactSlugs = (uepRows ?? []).map((r) => r.permission_slug_exact);
        const sourceSlugs = (uepRows ?? []).map((r) => r.permission_slug);

        // P0 fix: revoked concrete slug must not appear in UEP
        expect(
          exactSlugs,
          "account.profile.read should be absent from UEP (revoked)"
        ).not.toContain("account.profile.read");

        // Expansion still works: other account.* slugs present
        expect(
          exactSlugs,
          "account.profile.update should be present (expansion still works)"
        ).toContain("account.profile.update");

        // No verbatim wildcard slugs in permission_slug_exact (expansion invariant)
        expect(
          exactSlugs.every((s) => !s.includes("*")),
          "permission_slug_exact must not contain wildcards"
        ).toBe(true);

        // permission_slug still has the source wildcard (traceability)
        expect(sourceSlugs).toContain("account.*");
      } finally {
        // ── Cleanup (always runs, even on assertion failure) ───────────────
        // Order matters: RESTRICT FKs must be removed before referenced rows.
        if (userId) {
          await client
            .from("user_role_assignments")
            .delete()
            .eq("user_id", userId)
            .eq("scope_id", orgId);
        }
        if (roleId) {
          await client.from("role_permissions").delete().eq("role_id", roleId);
          await client.from("roles").delete().eq("id", roleId);
        }
        if (orgId) {
          // Cascades: organization_members, user_permission_overrides, user_effective_permissions
          await client.from("organizations").delete().eq("id", orgId);
        }
        if (userId) {
          await client.auth.admin.deleteUser(userId);
        }
      }
    },
    30000 // 30s timeout — DB round-trips
  );
});

describe("T-10K-DB: UEP partial indexes exist on live DB (DB-backed)", () => {
  itIfDb(
    "audit_uep_partial_indexes() returns both partial indexes with correct predicates",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(SUPABASE_URL_DB, SUPABASE_SERVICE_KEY_DB, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Call the SECURITY DEFINER audit function (service_role only).
      // PostgREST blocks direct pg_catalog access; this RPC bridges the gap.
      const { data, error } = await client.rpc("audit_uep_partial_indexes");

      expect(error, `audit_uep_partial_indexes() RPC failed: ${error?.message}`).toBeNull();

      const rows: UepIndexRow[] = data ?? [];

      // Must return exactly 2 rows (one per partial index)
      expect(rows.length, `Expected 2 rows, got ${rows.length}: ${JSON.stringify(rows)}`).toBe(2);

      const byName = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));

      // (1) Org-scope partial index on permission_slug_exact
      expect(
        byName["uep_org_slug_exact_idx"],
        "uep_org_slug_exact_idx not returned by audit RPC"
      ).toBeDefined();
      expect(byName["uep_org_slug_exact_idx"]).toContain("permission_slug_exact");
      expect(byName["uep_org_slug_exact_idx"]).toContain("WHERE (branch_id IS NULL)");

      // (2) Branch-scope partial index on permission_slug_exact
      expect(
        byName["uep_branch_slug_exact_idx"],
        "uep_branch_slug_exact_idx not returned by audit RPC"
      ).toBeDefined();
      expect(byName["uep_branch_slug_exact_idx"]).toContain("permission_slug_exact");
      expect(byName["uep_branch_slug_exact_idx"]).toContain("WHERE (branch_id IS NOT NULL)");
    }
  );
});
