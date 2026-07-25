/**
 * @vitest-environment node
 *
 * Tests: src/lib/api/invitations.ts
 * Uses node environment — no DOM needed; supabase/client is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mock ───────────────────────────────────────────────────────────────

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: mockCreateClient,
}));

import { fetchInvitationByToken } from "../invitations";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_INVITATION = {
  id: "inv-1",
  token: "tok-abc",
  email: "user@example.com",
  status: "pending",
  organization_id: "org-1",
  role_id: "role-1",
  branch_id: "branch-1",
  invited_by: "user-admin",
  expires_at: "2026-04-07T00:00:00Z",
  accepted_at: null,
  declined_at: null,
  created_at: "2026-03-31T00:00:00Z",
  deleted_at: null,
  invited_first_name: "Bob",
  invited_last_name: "Jones",
};

const ROLE_DATA = { id: "role-1", name: "Manager", display_name: "Manager" };
const BRANCH_DATA = { id: "branch-1", name: "HQ" };
const ORG_PROFILE_DATA = { organization_id: "org-1", name: "Acme Corp" };

/** Builds a minimal chainable supabase mock that resolves `.single()` with given result */
function makeSingleChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── fetchInvitationByToken ───────────────────────────────────────────────────

describe("fetchInvitationByToken", () => {
  it("returns null when invitation not found (PGRST116)", async () => {
    const chain = makeSingleChain({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    });
    mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue(chain) });

    const result = await fetchInvitationByToken("nonexistent-token");
    expect(result).toBeNull();
  });

  it("throws on non-PGRST116 DB error", async () => {
    const chain = makeSingleChain({
      data: null,
      error: { code: "500", message: "connection refused" },
    });
    mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue(chain) });

    await expect(fetchInvitationByToken("tok-abc")).rejects.toThrow(
      "Failed to fetch invitation: connection refused"
    );
  });

  it("returns null when invitation data is null but no error", async () => {
    const chain = makeSingleChain({ data: null, error: null });
    mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue(chain) });

    const result = await fetchInvitationByToken("tok-abc");
    expect(result).toBeNull();
  });

  it("returns invitation with role, branch, and organization on full success", async () => {
    const invChain = makeSingleChain({ data: VALID_INVITATION, error: null });
    const roleChain = makeSingleChain({ data: ROLE_DATA, error: null });
    const branchChain = makeSingleChain({ data: BRANCH_DATA, error: null });
    const orgChain = makeSingleChain({ data: ORG_PROFILE_DATA, error: null });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === "invitations") return invChain;
      if (table === "roles") return roleChain;
      if (table === "branches") return branchChain;
      if (table === "organization_profiles") return orgChain;
      return invChain;
    });
    mockCreateClient.mockReturnValue({ from: fromMock });

    const result = await fetchInvitationByToken("tok-abc");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("inv-1");
    expect(result!.role).toEqual(ROLE_DATA);
    expect(result!.branch).toEqual(BRANCH_DATA);
    expect(result!.organization).toEqual({ id: "org-1", name: "Acme Corp" });
  });

  it("skips role/branch/org fetches when ids are null", async () => {
    const invNoIds = { ...VALID_INVITATION, role_id: null, branch_id: null, organization_id: null };
    const invChain = makeSingleChain({ data: invNoIds, error: null });

    const fromMock = vi.fn().mockReturnValue(invChain);
    mockCreateClient.mockReturnValue({ from: fromMock });

    const result = await fetchInvitationByToken("tok-abc");

    expect(result).not.toBeNull();
    expect(result!.role).toBeNull();
    expect(result!.branch).toBeNull();
    expect(result!.organization).toBeNull();
    // Only the invitations table should be queried
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("invitations");
  });

  it("uses organization_id as org id in the returned organization field", async () => {
    const invChain = makeSingleChain({ data: VALID_INVITATION, error: null });
    const roleChain = makeSingleChain({ data: ROLE_DATA, error: null });
    const branchChain = makeSingleChain({ data: BRANCH_DATA, error: null });
    const orgChain = makeSingleChain({
      data: { organization_id: "org-1", name: "Acme Corp" },
      error: null,
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === "invitations") return invChain;
      if (table === "roles") return roleChain;
      if (table === "branches") return branchChain;
      if (table === "organization_profiles") return orgChain;
      return invChain;
    });
    mockCreateClient.mockReturnValue({ from: fromMock });

    const result = await fetchInvitationByToken("tok-abc");

    expect(result!.organization!.id).toBe("org-1");
  });

  it("sets organization to null when org profile data is null", async () => {
    const invChain = makeSingleChain({ data: VALID_INVITATION, error: null });
    const roleChain = makeSingleChain({ data: ROLE_DATA, error: null });
    const branchChain = makeSingleChain({ data: BRANCH_DATA, error: null });
    const orgChain = makeSingleChain({ data: null, error: null });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === "invitations") return invChain;
      if (table === "roles") return roleChain;
      if (table === "branches") return branchChain;
      if (table === "organization_profiles") return orgChain;
      return invChain;
    });
    mockCreateClient.mockReturnValue({ from: fromMock });

    const result = await fetchInvitationByToken("tok-abc");

    expect(result!.organization).toBeNull();
  });
});
