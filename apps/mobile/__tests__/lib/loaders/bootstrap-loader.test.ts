import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadBootstrapData } from "@/lib/loaders/bootstrap-loader";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
  status: number;
};

/**
 * Returns a deferred promise — the caller controls when it resolves.
 * Used in the concurrency test to prove all three queries are started
 * before any of them resolves.
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Creates a chainable Supabase-like query builder that resolves to `result`.
 * Every method returns `this` so the full chain is always awaitable.
 */
function makeBuilder(result: QueryResult | Promise<QueryResult>) {
  const p = result instanceof Promise ? result : Promise.resolve(result);
  const builder: Record<string, unknown> & PromiseLike<QueryResult> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    maybeSingle: () => builder,
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> => p.then(onfulfilled, onrejected),
    catch: (onrejected?: ((reason: unknown) => unknown) | null) => p.catch(onrejected),
    finally: (onfinally?: (() => void) | null) => p.finally(onfinally),
  };
  return builder;
}

/**
 * Builds a mock SupabaseClient where each table resolves to the provided result.
 */
function makeMock(results: Record<string, QueryResult>): SupabaseClient {
  return {
    from: vi.fn((table: string) =>
      makeBuilder(results[table] ?? { data: null, error: null, status: 200 })
    ),
  } as unknown as SupabaseClient;
}

const OK_PERM: QueryResult = { data: [], error: null, status: 200 };
const OK_ENT: QueryResult = { data: null, error: null, status: 200 };
const OK_PROF: QueryResult = { data: null, error: null, status: 200 };

const ALL_OK = {
  user_effective_permissions: OK_PERM,
  organization_entitlements: OK_ENT,
  organization_profiles: OK_PROF,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("loadBootstrapData", () => {
  // ── 1. Happy path — no subscription row, no profile row ─────────────────
  it("returns resolved with empty allow and null entitlements when no rows exist", async () => {
    const result = await loadBootstrapData(makeMock(ALL_OK), "u1", "o1");
    expect(result).toEqual({
      kind: "resolved",
      permissions: { allow: [], deny: [] },
      entitlements: null,
      orgName: null,
    });
  });

  // ── 2. Permissions rows are mapped to sorted allow slugs ─────────────────
  it("maps permission rows to a sorted allow list", async () => {
    const mock = makeMock({
      ...ALL_OK,
      user_effective_permissions: {
        data: [
          { permission_slug_exact: "org.update" },
          { permission_slug_exact: "members.read" },
          { permission_slug_exact: "branches.create" },
        ],
        error: null,
        status: 200,
      },
    });

    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.permissions.allow).toEqual(["branches.create", "members.read", "org.update"]);
    }
  });

  // ── 3. Filters out empty-string or non-string permission slugs ───────────
  it("filters non-string and empty-string slugs from the allow list", async () => {
    const mock = makeMock({
      ...ALL_OK,
      user_effective_permissions: {
        data: [
          { permission_slug_exact: "org.read" },
          { permission_slug_exact: "" },
          { permission_slug_exact: null },
          { permission_slug_exact: 42 },
        ],
        error: null,
        status: 200,
      },
    });

    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.permissions.allow).toEqual(["org.read"]);
    }
  });

  // ── 4. Normalizes entitlements row when present ──────────────────────────
  it("returns normalized entitlements when a subscription row exists", async () => {
    const entRow = {
      organization_id: "o1",
      plan_id: "plan-pro",
      plan_name: "Pro",
      enabled_modules: ["warehouse"],
      enabled_contexts: ["web"],
      features: { advanced: true },
      limits: { api_calls: 1000 },
      updated_at: "2026-01-01T00:00:00Z",
    };

    const mock = makeMock({
      ...ALL_OK,
      organization_entitlements: { data: entRow, error: null, status: 200 },
    });

    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.entitlements).toMatchObject({
        organization_id: "o1",
        enabled_modules: ["warehouse"],
      });
    }
  });

  // ── 5. Returns orgName when profile row has a non-empty name ─────────────
  it("returns orgName when profile row has a name", async () => {
    const mock = makeMock({
      ...ALL_OK,
      organization_profiles: { data: { name: "Acme Corp" }, error: null, status: 200 },
    });

    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.orgName).toBe("Acme Corp");
    }
  });

  // ── 6. Returns orgName=null when profile row has an empty name ───────────
  it("returns orgName null when profile name is empty string", async () => {
    const mock = makeMock({
      ...ALL_OK,
      organization_profiles: { data: { name: "" }, error: null, status: 200 },
    });

    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.orgName).toBeNull();
    }
  });

  // ── 7. Returns orgName=null when no profile row ───────────────────────────
  it("returns orgName null when profile data is null (no row)", async () => {
    const result = await loadBootstrapData(makeMock(ALL_OK), "u1", "o1");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.orgName).toBeNull();
    }
  });

  // ── 8. Permissions 403 → forbidden ───────────────────────────────────────
  it("returns forbidden when permissions query returns 403", async () => {
    const mock = makeMock({
      ...ALL_OK,
      user_effective_permissions: {
        data: null,
        error: { message: "forbidden" },
        status: 403,
      },
    });
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("forbidden");
  });

  // ── 9. Permissions 401 → invalid-session ─────────────────────────────────
  it("returns invalid-session when permissions query returns 401", async () => {
    const mock = makeMock({
      ...ALL_OK,
      user_effective_permissions: {
        data: null,
        error: { message: "JWT expired" },
        status: 401,
      },
    });
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("invalid-session");
  });

  // ── 10. Permissions 500 → error with message ─────────────────────────────
  it("returns error with message when permissions query returns 500", async () => {
    const mock = makeMock({
      ...ALL_OK,
      user_effective_permissions: {
        data: null,
        error: { message: "internal server error" },
        status: 500,
      },
    });
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("internal server error");
    }
  });

  // ── 11. Entitlements 403 → forbidden ─────────────────────────────────────
  it("returns forbidden when entitlements query returns 403", async () => {
    const mock = makeMock({
      ...ALL_OK,
      organization_entitlements: {
        data: null,
        error: { message: "forbidden" },
        status: 403,
      },
    });
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("forbidden");
  });

  // ── 12. 42501 SQLSTATE → forbidden (even on non-403 HTTP status) ─────────
  it("returns forbidden when a query returns SQLSTATE 42501 with status 200", async () => {
    const mock = makeMock({
      ...ALL_OK,
      user_effective_permissions: {
        data: null,
        error: { code: "42501", message: "insufficient_privilege" },
        status: 200,
      },
    });
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("forbidden");
  });

  // ── 13. Profile 403 → forbidden ──────────────────────────────────────────
  it("returns forbidden when profile query returns 403", async () => {
    const mock = makeMock({
      ...ALL_OK,
      organization_profiles: {
        data: null,
        error: { message: "forbidden" },
        status: 403,
      },
    });
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("forbidden");
  });

  // ── 14. Entitlements 500 → error ─────────────────────────────────────────
  it("returns error when entitlements query returns 500", async () => {
    const mock = makeMock({
      ...ALL_OK,
      organization_entitlements: {
        data: null,
        error: { message: "db timeout" },
        status: 500,
      },
    });
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("error");
  });

  // ── 15. Priority: permissions error wins over entitlements error ──────────
  it("returns permissions error (first in priority order) when both queries fail", async () => {
    const mock = makeMock({
      user_effective_permissions: {
        data: null,
        error: { message: "perm error" },
        status: 401,
      },
      organization_entitlements: {
        data: null,
        error: { message: "ent error" },
        status: 500,
      },
      organization_profiles: OK_PROF,
    });
    // permissions error (401 → invalid-session) takes priority over entitlements error (500 → error)
    const result = await loadBootstrapData(mock, "u1", "o1");
    expect(result.kind).toBe("invalid-session");
  });

  // ── 16. Concurrency: all three queries invoked before any resolves ────────
  it("invokes all three query chains concurrently before any result resolves", async () => {
    const permD = deferred<QueryResult>();
    const entD = deferred<QueryResult>();
    const profD = deferred<QueryResult>();
    const calledTables: string[] = [];

    const mock = {
      from: vi.fn((table: string) => {
        calledTables.push(table);
        if (table === "user_effective_permissions") return makeBuilder(permD.promise);
        if (table === "organization_entitlements") return makeBuilder(entD.promise);
        return makeBuilder(profD.promise); // organization_profiles
      }),
    } as unknown as SupabaseClient;

    const resultPromise = loadBootstrapData(mock, "u1", "o1");

    // Yield one microtask tick — enough for Promise.all to construct all
    // query chains synchronously. If queries were sequential (await each),
    // only the first from() would have fired at this point.
    await Promise.resolve();

    expect(calledTables).toHaveLength(3);
    expect(calledTables).toContain("user_effective_permissions");
    expect(calledTables).toContain("organization_entitlements");
    expect(calledTables).toContain("organization_profiles");

    // Now resolve all three so the function can complete
    permD.resolve({ data: [], error: null, status: 200 });
    entD.resolve({ data: null, error: null, status: 200 });
    profD.resolve({ data: null, error: null, status: 200 });

    const result = await resultPromise;
    expect(result.kind).toBe("resolved");
  });
});
