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
});
