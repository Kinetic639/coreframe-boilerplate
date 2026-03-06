/**
 * @vitest-environment node
 *
 * Bootstrap Remediation Tests
 *
 * Verifies:
 *  1. signUpAction passes invitation_token in user_metadata when token is present
 *  2. signUpAction does NOT pass invitation_token when no token is present
 *  3. signUpAction preserves invitation_token in the emailRedirectTo callback URL
 *  4. Legacy acceptInvitation / rejectInvitation are removed from lib/api/invitations
 *  5. Legacy acceptInvitationAction / rejectInvitationAction are removed from actions/invitations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase mock ────────────────────────────────────────────────────────────
const { signUpMock } = vi.hoisted(() => ({ signUpMock: vi.fn() }));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: signUpMock,
    },
  }),
}));

// next-intl server helpers
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("pl"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

// next navigation redirect (not used in signUp happy path, but mocked to avoid throws)
vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn(),
}));

// next/navigation redirect used by encodedRedirect in utils.ts
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// ─── Subject under test ───────────────────────────────────────────────────────
import { signUpAction } from "@/app/[locale]/actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("email", overrides.email ?? "user@example.com");
  fd.append("password", overrides.password ?? "Password1");
  if (overrides.firstName) fd.append("firstName", overrides.firstName);
  if (overrides.lastName) fd.append("lastName", overrides.lastName);
  if (overrides.invitationToken) fd.append("invitationToken", overrides.invitationToken);
  return fd;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("signUpAction — invitation_token in metadata", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    // Return a valid user so the action doesn't error
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
  });

  it("includes invitation_token in user_metadata when invitationToken is provided", async () => {
    await signUpAction(makeFormData({ invitationToken: "tok-abc-123" }));

    expect(signUpMock).toHaveBeenCalledOnce();
    const callArgs = signUpMock.mock.calls[0][0];
    expect(callArgs.options.data).toMatchObject({ invitation_token: "tok-abc-123" });
  });

  it("does NOT include invitation_token in user_metadata for regular signup", async () => {
    await signUpAction(makeFormData());

    expect(signUpMock).toHaveBeenCalledOnce();
    const callArgs = signUpMock.mock.calls[0][0];
    expect(callArgs.options.data).not.toHaveProperty("invitation_token");
  });

  it("also includes first_name and last_name in metadata", async () => {
    await signUpAction(makeFormData({ firstName: "Anna", lastName: "Nowak" }));

    const callArgs = signUpMock.mock.calls[0][0];
    expect(callArgs.options.data).toMatchObject({ first_name: "Anna", last_name: "Nowak" });
  });

  it("preserves invitation_token in emailRedirectTo callback URL", async () => {
    await signUpAction(makeFormData({ invitationToken: "tok-xyz" }));

    const callArgs = signUpMock.mock.calls[0][0];
    const redirectTo: string = callArgs.options.emailRedirectTo;
    expect(redirectTo).toContain("invitation_token=");
    expect(redirectTo).toContain(encodeURIComponent("tok-xyz"));
  });

  it("emailRedirectTo has no invitation_token param when no token provided", async () => {
    await signUpAction(makeFormData());

    const callArgs = signUpMock.mock.calls[0][0];
    const redirectTo: string = callArgs.options.emailRedirectTo;
    expect(redirectTo).not.toContain("invitation_token");
  });
});

describe("Legacy invitation mutations — removed from lib/api/invitations", () => {
  it("acceptInvitation is no longer exported from lib/api/invitations", async () => {
    const api = await import("@/lib/api/invitations");
    expect((api as Record<string, unknown>)["acceptInvitation"]).toBeUndefined();
  });

  it("rejectInvitation is no longer exported from lib/api/invitations", async () => {
    const api = await import("@/lib/api/invitations");
    expect((api as Record<string, unknown>)["rejectInvitation"]).toBeUndefined();
  });

  it("fetchInvitationByToken is still exported (used by sign-up-form)", async () => {
    const api = await import("@/lib/api/invitations");
    expect(typeof api.fetchInvitationByToken).toBe("function");
  });

  it("cancelInvitation is still exported (used by InvitationManagementView)", async () => {
    const api = await import("@/lib/api/invitations");
    expect(typeof api.cancelInvitation).toBe("function");
  });
});

describe("Legacy invitation mutations — removed from app/actions/invitations", () => {
  it("acceptInvitationAction is no longer exported from actions/invitations", async () => {
    const actions = await import("@/app/actions/invitations");
    expect((actions as Record<string, unknown>)["acceptInvitationAction"]).toBeUndefined();
  });

  it("rejectInvitationAction is no longer exported from actions/invitations", async () => {
    const actions = await import("@/app/actions/invitations");
    expect((actions as Record<string, unknown>)["rejectInvitationAction"]).toBeUndefined();
  });
});
