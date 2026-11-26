import { describe, expect, it, vi } from "vitest";
import type { PortalContext } from "@/server/portal-context";
import type { PortalSupabase } from "@/utils/supabase/server";
import { closeOwnRequest, createRequest, listRequests } from "../requests.service";

const ctx = {
  user: {
    id: "u1",
    email: "a@example.com",
    firstName: "Anna",
    lastName: "K",
    displayName: "Anna K",
    initials: "AK",
    avatarUrl: null,
  },
  org: { id: "org1", name: "Org" },
  branches: [{ id: "b1", name: "Branch" }],
  activeBranchId: null,
  scopeBranchIds: ["b1"],
  can: { create: () => true, manage: () => false, manageTypes: false },
} satisfies PortalContext;

/** A PostgREST query builder stand-in: every call chains, awaiting it gives `result`. */
function chain(result: unknown) {
  const proxy: unknown = new Proxy(() => {}, {
    get: (_t, prop) =>
      prop === "then" ? (resolve: (v: unknown) => void) => resolve(result) : () => proxy,
    apply: () => proxy,
  });
  return proxy;
}

function client(rpc: (fn: string, args: Record<string, unknown>) => unknown, fromResult?: unknown) {
  const from = vi.fn(() => chain(fromResult ?? { data: [], error: null, count: 0 }));
  return {
    client: {
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => rpc(fn, args)),
      from,
    } as unknown as PortalSupabase,
    from,
  };
}

const row = {
  id: "t1",
  ticket_number: "HD-000142",
  title: "Kiedy zderzak?",
  status: "waiting_response",
  requires_acceptance: false,
  accepted_at: null,
  branch_id: "b1",
  created_by: "u1",
  created_at: "2026-11-25T14:40:00Z",
  updated_at: "2026-11-26T12:42:00Z",
  ticket_type: { id: "ty1", name: "Części", color: "#2563EB", icon: "box" },
  creator: {
    id: "u1",
    first_name: "Anna",
    last_name: "K",
    email: "a@example.com",
    avatar_url: null,
  },
  order_ref: {
    source_type: "repair_order",
    source_id: "ro1",
    context_snapshot: { order_number: "51481", warehouse: "3112", zl_number: "ZL/51481/3112" },
  },
  comment_count: 3,
};

describe("listRequests", () => {
  it("reads a page in one RPC and maps it", async () => {
    const { client: supabase, from } = client(() => ({
      data: { total: 1, rows: [row] },
      error: null,
    }));
    const res = await listRequests(supabase, ctx, {
      scope: "mine",
      filter: "yourTurn",
      typeId: null,
      search: "51481",
      sort: "activity",
      page: 2,
    });
    expect(from).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "portal_request_list",
      expect.objectContaining({
        p_org_id: "org1",
        p_branch_ids: ["b1"],
        p_mine: true,
        p_filter: "yourTurn",
        p_search: "51481",
        p_offset: 25,
      })
    );
    expect(res).toEqual({
      ok: true,
      data: {
        total: 1,
        items: [
          expect.objectContaining({
            id: "t1",
            number: "HD-000142",
            state: "yourTurn",
            commentCount: 3,
            isMine: true,
            order: {
              orderNumber: "51481",
              warehouse: "3112",
              zlNumber: "ZL/51481/3112",
              repairOrderId: "ro1",
            },
          }),
        ],
      },
    });
  });

  it("falls back to the separate queries when the function is missing", async () => {
    const { client: supabase, from } = client(() => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    }));
    const res = await listRequests(supabase, ctx, {
      scope: "branch",
      filter: "open",
      sort: "newest",
      page: 1,
    });
    expect(from).toHaveBeenCalledWith("helpdesk_tickets");
    expect(res).toEqual({ ok: true, data: { total: 0, items: [] } });
  });
});

describe("saves", () => {
  it("creates a request in one RPC with the order", async () => {
    const { client: supabase, from } = client(() => ({
      data: { id: "t9", ticket_number: "HD-000150" },
      error: null,
    }));
    const res = await createRequest(supabase, ctx, {
      branchId: "b1",
      typeId: "ty1",
      title: "Zderzak",
      description: "Linia 1\nLinia 2",
      orderNumber: "51481",
      warehouse: "3112",
    });
    expect(res).toEqual({ ok: true, data: { id: "t9", number: "HD-000150" } });
    expect(from).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "portal_create_request",
      expect.objectContaining({ p_order_number: "51481", p_warehouse: "3112" })
    );
  });

  it("reports an unknown type without the fallback", async () => {
    const { client: supabase, from } = client(() => ({
      data: null,
      error: { code: "P0002", message: "unknown_type" },
    }));
    const res = await createRequest(supabase, ctx, {
      branchId: "b1",
      typeId: "ty1",
      title: "Zderzak",
      description: null,
      orderNumber: null,
      warehouse: null,
    });
    expect(res).toEqual({ ok: false, error: "unknown_type" });
    expect(from).not.toHaveBeenCalled();
  });

  it("closes in one RPC and returns the saved row", async () => {
    const { client: supabase } = client(() => ({
      data: { ...row, status: "closed" },
      error: null,
    }));
    const res = await closeOwnRequest(supabase, ctx, "t1", "closed");
    expect(res.ok && res.data.state).toBe("closed");
  });

  it("maps a request that is no longer open to not_found", async () => {
    const { client: supabase } = client(() => ({
      data: null,
      error: { code: "P0002", message: "not_found" },
    }));
    expect(await closeOwnRequest(supabase, ctx, "t1", "cancelled")).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});
