/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockExchangeCodeForSession, mockRpc } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { GET } from "../route";

function makeRequest(url: string) {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    rpc: mockRpc,
  });
});

describe("GET /auth/callback", () => {
  it("redirects to onboarding when no code is present", async () => {
    const response = await GET(makeRequest("https://example.com/auth/callback"));

    expect(response.headers.get("location")).toBe("https://example.com/onboarding");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("exchanges the code and respects redirect_to", async () => {
    mockRpc.mockResolvedValue({ data: { success: true, invitations: [] } });

    const response = await GET(
      makeRequest("https://example.com/auth/callback?code=abc123&redirect_to=/dashboard/tools")
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("location")).toBe("https://example.com/dashboard/tools");
  });

  it("redirects back to invite page when invitation acceptance fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const response = await GET(
      makeRequest("https://example.com/auth/callback?code=abc123&invitation_token=invite-1")
    );

    expect(mockRpc).toHaveBeenCalledWith("accept_invitation_and_join_org", {
      p_token: "invite-1",
    });
    expect(response.headers.get("location")).toBe("https://example.com/invite/invite-1");

    errorSpy.mockRestore();
  });

  it("redirects to resolve page when pending invites exist after sign in", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, invitations: [{ id: "invite-1" }] },
    });

    const response = await GET(makeRequest("https://example.com/auth/callback?code=abc123"));

    expect(mockRpc).toHaveBeenCalledWith("get_my_pending_invitations");
    expect(response.headers.get("location")).toBe("https://example.com/invite/resolve");
  });
});
