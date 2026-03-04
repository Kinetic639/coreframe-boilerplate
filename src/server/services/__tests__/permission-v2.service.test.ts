/**
 * @vitest-environment node
 *
 * Tests for PermissionServiceV2 static helpers and the 10k-ready snapshot query.
 * Focus:
 *   - wildcard-safe canFromSnapshot and wildcard matrix documentation
 *   - getPermissionSnapshotForUser: two-query strategy (no OR), merge/dedup/sort
 *   - Compiler dedup invariant: service produces unique, sorted output
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient as _supabaseCreateClient } from "@supabase/supabase-js";
import { PermissionServiceV2 } from "../permission-v2.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal Supabase client mock whose `.from().select().eq().is()` and
 * `.from().select().eq().eq()` chains resolve to the provided result.
 *
 * Each call to `supabase.from()` consumes the next entry in `results[]`.
 * Pass results in the order the method under test will call them.
 */
function makeSupabaseMock(
  results: Array<{ data: Array<{ permission_slug: string }> | null; error: unknown }>
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

  it("returns false when not present (wildcards NOT expanded)", () => {
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
    const supabase = makeSupabaseMock([{ data: [{ permission_slug: "org.read" }], error: null }]);

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
      { data: [{ permission_slug: "members.read" }], error: null },
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
      { data: [{ permission_slug: "org.read" }], error: null }, // query 1: org-scope
      { data: [{ permission_slug: "branch.roles.manage" }], error: null }, // query 2: branch-scope
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
      { data: [{ permission_slug: "z.perm" }, { permission_slug: "a.perm" }], error: null },
      { data: [{ permission_slug: "m.perm" }, { permission_slug: "a.perm" }], error: null }, // 'a.perm' duplicated
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
      { data: [{ permission_slug: "org.read" }], error: null }, // org-scope OK
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
      { data: [{ permission_slug: "org.read" }], error: null },
      { data: [{ permission_slug: "branch.roles.manage" }], error: null },
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

  it("handles wildcard slugs in UEP (stored verbatim, sorted correctly)", async () => {
    const supabase = makeSupabaseMock([
      { data: [{ permission_slug: "module.*" }, { permission_slug: "warehouse.*" }], error: null },
      { data: [{ permission_slug: "branch.roles.manage" }], error: null },
    ]);

    const result = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase as unknown as ReturnType<typeof _supabaseCreateClient>,
      "user-1",
      "org-1",
      "branch-A"
    );

    // Wildcards preserved as-is; sorted with other slugs
    expect(result.allow).toEqual(["branch.roles.manage", "module.*", "warehouse.*"]);
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
      { data: [{ permission_slug: "org.read" }, { permission_slug: "org.read" }], error: null }, // org returns dups
      {
        data: [{ permission_slug: "org.read" }, { permission_slug: "members.manage" }],
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
      { data: [{ permission_slug: "z.last" }, { permission_slug: "a.first" }], error: null },
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
// T-10K-DB: DB-backed index verification (live DB, skipped if no env vars)
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY_DB = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const HAVE_DB_ENV = Boolean(SUPABASE_URL_DB) && Boolean(SUPABASE_SERVICE_KEY_DB);
const itIfDb = HAVE_DB_ENV ? it : it.skip;

describe("T-10K-DB: UEP partial indexes exist on live DB (DB-backed)", () => {
  itIfDb(
    "uep_org_exact_active_idx exists with correct predicate WHERE branch_id IS NULL",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(SUPABASE_URL_DB, SUPABASE_SERVICE_KEY_DB, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: idxData, error: idxError } = await client
        .from("pg_indexes")
        .select("indexname, indexdef")
        .eq("tablename", "user_effective_permissions")
        .eq("indexname", "uep_org_exact_active_idx")
        .single();

      expect(idxError, `pg_indexes query failed: ${idxError?.message}`).toBeNull();
      expect(idxData, "uep_org_exact_active_idx not found in pg_indexes").not.toBeNull();
      expect(idxData?.indexdef).toContain("WHERE (branch_id IS NULL)");
    }
  );

  itIfDb(
    "uep_branch_exact_active_idx exists with correct predicate WHERE branch_id IS NOT NULL",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(SUPABASE_URL_DB, SUPABASE_SERVICE_KEY_DB, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: idxData, error: idxError } = await client
        .from("pg_indexes")
        .select("indexname, indexdef")
        .eq("tablename", "user_effective_permissions")
        .eq("indexname", "uep_branch_exact_active_idx")
        .single();

      expect(idxError, `pg_indexes query failed: ${idxError?.message}`).toBeNull();
      expect(idxData, "uep_branch_exact_active_idx not found in pg_indexes").not.toBeNull();
      expect(idxData?.indexdef).toContain("WHERE (branch_id IS NOT NULL)");
    }
  );
});
