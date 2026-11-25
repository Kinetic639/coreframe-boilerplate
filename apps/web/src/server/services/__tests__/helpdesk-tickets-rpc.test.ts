/**
 * @vitest-environment node
 * Tests: the one-request paths of HelpdeskTicketsService
 * (migration 20261126090000_helpdesk_ticket_rpc).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/storage/avatar-signed-url", () => ({
  getSignedAvatarUrls: vi.fn(async () => new Map([["u-creator", "https://signed/creator"]])),
}));
vi.mock("@/server/auth/get-auth-user", () => ({
  getAuthUser: vi.fn(async () => ({ data: { user: { id: "u-creator" } }, error: null })),
}));
const { listProfiles } = vi.hoisted(() => ({ listProfiles: vi.fn() }));
vi.mock("../org-member-public-profile.service", () => ({
  OrgMemberPublicProfileService: { listProfiles },
}));

import { HelpdeskTicketsService, resetHelpdeskRpcState } from "../helpdesk-tickets.service";

const ORG = "11111111-1111-4111-8111-111111111111";

const user = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  first_name: "Ala",
  last_name: id,
  email: `${id}@x.pl`,
  avatar_url: null,
  avatar_path: null,
  ...extra,
});

const rawRow = {
  id: "t-1",
  org_id: ORG,
  ticket_number: "HD-000001",
  title: "Printer",
  status: "open",
  priority: "high",
  ticket_type_id: "type-1",
  created_by: "u-creator",
  assigned_to: "u-handler",
  branch_id: "b-1",
  closed_at: null,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
  requires_acceptance: true,
  accepted_by: "u-acceptor",
  accepted_at: "2026-11-03T10:00:00Z",
  ticket_type: { id: "type-1", name: "IT", color: "#000", icon: "printer" },
  creator: user("u-creator", { avatar_path: "u-creator/a.webp" }),
  acceptor: user("u-acceptor"),
  assignees: [
    { user_id: "u-handler", role: "responder", status: "assigned", user: user("u-handler") },
  ],
  comment_count: 3,
  attachment_count: 1,
};

function client(rpc: (name: string, args: Record<string, unknown>) => unknown) {
  return {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => rpc(name, args)),
    from: vi.fn(() => {
      throw new Error("separate request");
    }),
  } as any;
}

const params = {
  search: "print",
  page: 2,
  pageSize: 20,
  sort: { field: "title", direction: "asc" as const },
  filters: { status: ["open"], assignedTo: ["u-handler"], unassigned: null },
};

describe("HelpdeskTicketsService one-request paths", () => {
  beforeEach(() => {
    resetHelpdeskRpcState();
    listProfiles.mockResolvedValue({ success: true, data: [] });
  });

  it("reads a list page with helpdesk_ticket_list and maps its rows", async () => {
    const supabase = client(() => ({ data: { total: 41, rows: [rawRow] }, error: null }));
    const result = await HelpdeskTicketsService.listForDataView(supabase, ORG, params);

    expect(supabase.rpc).toHaveBeenCalledWith(
      "helpdesk_ticket_list",
      expect.objectContaining({
        p_org_id: ORG,
        p_search: "print",
        p_status: ["open"],
        p_assigned_to: ["u-handler"],
        p_unassigned: false,
        p_sort: "title",
        p_desc: false,
        p_limit: 20,
        p_offset: 20,
      })
    );
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.totalCount).toBe(41);
    const row = result.data.rows[0];
    expect(row).toMatchObject({
      ticket_number: "HD-000001",
      ticket_type_name: "IT",
      creator_name: "Ala u-creator",
      creator_avatar_url: "https://signed/creator",
      accepted_by_name: "Ala u-acceptor",
      assigned_to: "u-handler",
      comment_count: 3,
      attachment_count: 1,
    });
    expect(row.assignees).toEqual([
      expect.objectContaining({ user_id: "u-handler", name: "Ala u-handler" }),
    ]);
  });

  it("falls back to the separate requests once the function is missing, and remembers it", async () => {
    const supabase = client(() => ({
      data: null,
      error: { code: "PGRST202", message: "missing" },
    }));
    await expect(HelpdeskTicketsService.listForDataView(supabase, ORG, params)).rejects.toThrow(
      "separate request"
    );
    await expect(HelpdeskTicketsService.listForDataView(supabase, ORG, params)).rejects.toThrow(
      "separate request"
    );
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("reads a ticket card with helpdesk_ticket_view: comments page, QR code and handling right", async () => {
    const comments = Array.from({ length: 51 }, (_, i) => ({
      id: `c-${i}`,
      org_id: ORG,
      target_type: "helpdesk.ticket",
      target_id: "t-1",
      body_plain: `comment ${i}`,
      body_rich: null,
      visibility: "default",
      kind: "comment",
      parent_comment_id: null,
      metadata: null,
      created_by: "u-creator",
      updated_by: null,
      created_at: `2026-11-01T10:${String(i).padStart(2, "0")}:00Z`,
      updated_at: "2026-11-01T10:00:00Z",
      deleted_at: null,
    }));
    const supabase = client(() => ({
      data: {
        ticket: { ...rawRow, comment_count: 60, description_plain: "Jams", due_at: null },
        acceptors: [{ user_id: "u-acceptor", user: user("u-acceptor") }],
        activity: [
          {
            id: "a-1",
            ticket_id: "t-1",
            org_id: ORG,
            actor_id: "u-handler",
            event_type: "status_changed",
            payload: { from: "open", to: "in_progress" },
            created_at: "2026-11-02T10:00:00Z",
            actor: { id: "u-handler", first_name: "Jan", last_name: "K", email: null },
          },
        ],
        comments,
        qr: {
          id: "qa-1",
          qr_code_id: "qr-1",
          qr_codes: { token: "TOK", label: null, status: "active" },
        },
        can_manage: true,
      },
      error: null,
    }));

    const result = await HelpdeskTicketsService.getDetail(supabase, ORG, "HD-000001");
    expect(supabase.rpc).toHaveBeenCalledWith("helpdesk_ticket_view", {
      p_org_id: ORG,
      p_ticket_number: "HD-000001",
      p_comment_limit: 50,
    });
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("no detail");
    const detail = result.data;
    expect(detail.comments).toHaveLength(50);
    expect(detail.comments_total).toBe(60);
    expect(detail.comments_next_cursor).toBe("2026-11-01T10:49:00Z|c-49");
    expect(detail.can_manage).toBe(true);
    expect(detail.qr_assignment).toEqual({
      assignmentId: "qa-1",
      qrCodeId: "qr-1",
      token: "TOK",
      label: null,
      status: "active",
    });
    expect(detail.accepted_by_name).toBe("Ala u-acceptor");
    expect(detail.activity[0]).toMatchObject({ actor_name: "Jan K", event_type: "status_changed" });
    expect(detail.acceptors[0]).toMatchObject({ user_id: "u-acceptor", name: "Ala u-acceptor" });
    expect(detail.description_plain).toBe("Jams");
  });

  it("returns no ticket when the view finds none", async () => {
    const supabase = client(() => ({ data: null, error: null }));
    expect(await HelpdeskTicketsService.getDetail(supabase, ORG, "HD-9")).toEqual({
      success: true,
      data: null,
    });
  });

  it("saves through the RPC and returns the ticket row; errors are not retried another way", async () => {
    const ok = client(() => ({ data: { ...rawRow, status: "resolved" }, error: null }));
    const saved = await HelpdeskTicketsService.saveViaRpc(ok, "helpdesk_set_ticket_status", {
      p_ticket_id: "t-1",
      p_status: "resolved",
    });
    expect(saved).toMatchObject({ success: true, data: { id: "t-1", status: "resolved" } });

    const refused = client(() => ({
      data: null,
      error: { code: "42501", message: "Insufficient permissions" },
    }));
    expect(
      await HelpdeskTicketsService.saveViaRpc(refused, "helpdesk_take_ticket", {
        p_ticket_id: "t-1",
      })
    ).toEqual({ success: false, error: "Insufficient permissions" });

    const missing = client(() => ({
      data: null,
      error: { code: "42883", message: "no function" },
    }));
    expect(
      await HelpdeskTicketsService.saveViaRpc(missing, "helpdesk_close_ticket", {
        p_ticket_id: "t-1",
      })
    ).toBeUndefined();
  });
});
