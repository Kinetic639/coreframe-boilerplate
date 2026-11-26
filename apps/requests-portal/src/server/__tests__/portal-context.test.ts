import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };
const state = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  apps: { data: [], error: null } as Result,
}));

// A thenable query builder: every filter returns itself, awaiting gives the table's rows.
function query(table: string) {
  const result = { data: state.tables[table] ?? null, error: null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: Result) => unknown) => resolve(result),
  };
  for (const method of ["select", "eq", "is", "order"]) builder[method] = () => builder;
  builder.maybeSingle = async () => result;
  return builder;
}

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "doradca@example.com" } } }) },
    from: query,
    rpc: async () => state.apps,
  }),
}));

import { loadPortalContext } from "../portal-context";

describe("loadPortalContext: the plan must include the portal", () => {
  beforeEach(() => {
    state.tables = {
      user_effective_permissions: [
        {
          organization_id: "org-1",
          branch_id: null,
          permission_slug_exact: "helpdesk.tickets.read",
        },
      ],
      user_preferences: null,
      users: { first_name: "Jan", last_name: "Nowak", avatar_url: null },
      organizations: [{ id: "org-1", name: "Hurtownia" }],
      branches: [{ id: "b1", name: "Kraków", organization_id: "org-1" }],
    };
  });

  it("opens the portal and lists the user's apps for the switcher", async () => {
    state.apps = {
      data: [
        { organization_id: "org-1", app: "requests" },
        { organization_id: "org-1", app: "erp" },
      ],
      error: null,
    };
    const result = await loadPortalContext();
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.context.apps).toEqual(["erp", "requests"]);
  });

  it("refuses when the organization's plan lacks the portal", async () => {
    state.apps = { data: [{ organization_id: "org-1", app: "erp" }], error: null };
    await expect(loadPortalContext()).resolves.toEqual({
      status: "no-access",
      email: "doradca@example.com",
    });
  });

  it("falls back to the permission check when the rule cannot run", async () => {
    state.apps = { data: null, error: { message: "function does not exist" } };
    const result = await loadPortalContext();
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.context.apps).toEqual([]);
  });
});
