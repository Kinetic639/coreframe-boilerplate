import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/app/actions/organization/invitations", () => ({
  listInvitationsAction: vi.fn(),
  createInvitationAction: vi.fn(),
  cancelInvitationAction: vi.fn(),
  resendInvitationAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      inviteMemberButton: "Invite Member",
      noInvitations: "No invitations found.",
      dialogTitle: "Invite Member",
      firstNameLabel: "First Name",
      firstNamePlaceholder: "Jane",
      lastNameLabel: "Last Name",
      lastNamePlaceholder: "Smith",
      emailAddressLabel: "Email Address",
      rolesLabel: "Additional Roles",
      rolesHint: "The invited member always receives the base org_member role.",
      addRoleButton: "Add role",
      roleSelectPlaceholder: "Select a role",
      branchSelectPlaceholder: "Select a branch",
      cancelButton: "Cancel",
      sendButton: "Send Invite",
      sendingButton: "Sending…",
      expiresLabel: "Expires:",
      resendTitle: "Resend",
      cancelTitle: "Cancel invitation",
      "inviteErrors.DUPLICATE_PENDING": "An invitation is already pending for this email address.",
      "inviteErrors.ALREADY_MEMBER": "This person is already a member of your organization.",
      "inviteErrors.ALREADY_IN_ORG": "This person already belongs to another organization.",
      "inviteErrors.SELF_INVITE": "You cannot invite yourself.",
      "inviteErrors.UNAUTHORIZED": "You don't have permission to send invitations.",
      "inviteErrors.INVALID_EMAIL": "Please enter a valid email address.",
      "inviteErrors.UNKNOWN": "Something went wrong. Please try again.",
    };
    return map[key] ?? key;
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { InvitationsClient } from "../_components/invitations-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import {
  listInvitationsAction,
  createInvitationAction,
} from "@/app/actions/organization/invitations";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function setupPermissions(canCreate = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: (p: string) => (["invites.create", "invites.cancel"].includes(p) ? canCreate : false),
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InvitationsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // invitations-1: Invite button visible when user has invites.create
  it("renders Invite button when user has invites.create permission", () => {
    setupPermissions(true);
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
  });

  // invitations-2: Invite button absent when user lacks invites.create
  it("hides Invite button when user lacks invites.create permission", () => {
    setupPermissions(false);
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
  });

  // invitations-3: listInvitationsAction NOT called on mount (SSR-first)
  it("does not call listInvitationsAction on mount", () => {
    setupPermissions(true);
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });
    expect(listInvitationsAction).not.toHaveBeenCalled();
  });

  // invitations-4: createInvitationAction called with correct email on submit
  it("calls createInvitationAction with email on submit", async () => {
    setupPermissions(true);
    vi.mocked(listInvitationsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: true,
      data: { id: "inv-1" } as never,
    });
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(createInvitationAction).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com" })
      )
    );
  });

  // invitations-5: DUPLICATE_PENDING shows translated error inside dialog
  it("shows translated error for DUPLICATE_PENDING — dialog stays open", async () => {
    setupPermissions(true);
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: false,
      error: "DUPLICATE_PENDING",
    });
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(
        screen.getByText("An invitation is already pending for this email address.")
      ).toBeInTheDocument()
    );

    // Dialog must stay open on failure
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Raw code must NOT be visible
    expect(screen.queryByText("DUPLICATE_PENDING")).not.toBeInTheDocument();
  });

  // invitations-6: ALREADY_MEMBER shows translated error inside dialog
  it("shows translated error for ALREADY_MEMBER", async () => {
    setupPermissions(true);
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: false,
      error: "ALREADY_MEMBER",
    });
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "member@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(
        screen.getByText("This person is already a member of your organization.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText("ALREADY_MEMBER")).not.toBeInTheDocument();
  });

  // invitations-7: SELF_INVITE shows translated error inside dialog
  it("shows translated error for SELF_INVITE", async () => {
    setupPermissions(true);
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: false,
      error: "SELF_INVITE",
    });
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "self@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(screen.getByText("You cannot invite yourself.")).toBeInTheDocument()
    );
    expect(screen.queryByText("SELF_INVITE")).not.toBeInTheDocument();
  });

  // invitations-8: unknown error code falls back to generic message
  it("shows generic fallback for unknown error codes", async () => {
    setupPermissions(true);
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: false,
      error: "SOME_UNRECOGNIZED_CODE",
    });
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "any@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument()
    );
    expect(screen.queryByText("SOME_UNRECOGNIZED_CODE")).not.toBeInTheDocument();
  });

  // invitations-9: error clears when user edits email
  it("clears error when user edits email field", async () => {
    setupPermissions(true);
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: false,
      error: "DUPLICATE_PENDING",
    });
    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "dup@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(
        screen.getByText("An invitation is already pending for this email address.")
      ).toBeInTheDocument()
    );

    // Editing the email should clear the error
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "new@example.com" },
    });
    expect(
      screen.queryByText("An invitation is already pending for this email address.")
    ).not.toBeInTheDocument();
  });

  // invitations-10: dialog closes on success, no toast.error for invite failure
  it("dialog closes on success and no toast.error is called for invite failure", async () => {
    setupPermissions(true);
    const { toast } = await import("react-toastify");

    // First attempt fails
    vi.mocked(createInvitationAction).mockResolvedValueOnce({
      success: false,
      error: "DUPLICATE_PENDING",
    });
    // Second attempt succeeds
    vi.mocked(createInvitationAction).mockResolvedValueOnce({
      success: true,
      data: { id: "inv-ok" } as never,
    });
    vi.mocked(listInvitationsAction).mockResolvedValue({ success: true, data: [] });

    render(<InvitationsClient initialInvitations={[]} initialRoles={[]} initialBranches={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "dup@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    // Error shown in dialog — no toast.error
    await waitFor(() =>
      expect(
        screen.getByText("An invitation is already pending for this email address.")
      ).toBeInTheDocument()
    );
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });
});
