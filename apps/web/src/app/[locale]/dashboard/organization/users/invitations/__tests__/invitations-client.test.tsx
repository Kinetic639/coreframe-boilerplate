import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({ usePermissions: vi.fn() }));
vi.mock("@/lib/stores/v2/app-store", () => ({ useAppStoreV2: () => "org-1" }));

vi.mock("@/hooks/queries/organization", () => ({
  useInvitationsQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useRolesQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useBranchesQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useInvitationsRealtimeSync: vi.fn(),
  useCreateInvitationMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelInvitationMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useResendInvitationMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      inviteMemberButton: "Invite Member",
      noInvitations: "No invitations found.",
      dialogTitle: "Invite Member",
      cancelButton: "Cancel",
      sendButton: "Send Invite",
      sendingButton: "Sending…",
    };
    return map[key] ?? key;
  },
}));

vi.mock("nuqs", () => ({
  useQueryState: vi.fn(() => [null, vi.fn()]),
  useQueryStates: vi.fn(() => [
    { selected: null, search: "", sort: null, page: 1, pageSize: 50, filters: {} },
    vi.fn(),
  ]),
  parseAsString: { withDefault: () => ({}) },
  parseAsInteger: { withDefault: () => ({}) },
  parseAsJson: { withDefault: () => ({}) },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { InvitationsClient } from "../_components/invitations-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import type { OrgInvitation } from "@/server/services/organization.service";
import type { PaginatedResult } from "@/components/data-view/data-view.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function setupPermissions(canCreate = true, canCancel = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: (p: string) => {
      if (p === "invites.create") return canCreate;
      if (p === "invites.cancel") return canCancel;
      return false;
    },
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

const sampleInvitation: OrgInvitation = {
  id: "inv-1",
  email: "bob@example.com",
  invited_by: "u-1",
  organization_id: "org-1",
  token: "tok-1",
  status: "pending",
  expires_at: null,
  accepted_at: null,
  declined_at: null,
  created_at: null,
  deleted_at: null,
  invited_first_name: null,
  invited_last_name: null,
  role_summary: null,
};

function makeInitialData(invitations: OrgInvitation[] = []): PaginatedResult<OrgInvitation> {
  return { rows: invitations, totalCount: invitations.length, page: 1, pageSize: 50 };
}

function renderClient(invitations: OrgInvitation[] = []) {
  return render(
    <InvitationsClient
      initialData={makeInitialData(invitations)}
      allInvitations={invitations}
      initialRoles={[]}
      initialBranches={[]}
    />,
    { wrapper: createWrapper() }
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InvitationsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // inv-1: Invite Member button visible when user has invites.create
  it("renders Invite Member button when user has invites.create", () => {
    setupPermissions(true);
    renderClient();
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
  });

  // inv-2: Invite Member button hidden when user lacks invites.create
  it("hides Invite Member button when user lacks invites.create", () => {
    setupPermissions(false);
    renderClient();
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
  });

  // inv-3: Dialog opens when Invite Member is clicked
  it("opens invite dialog when Invite Member is clicked", async () => {
    setupPermissions(true);
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  // inv-4: Renders without crashing with invitation data
  it("renders without crashing with invitation data", () => {
    setupPermissions(true);
    renderClient([sampleInvitation]);
    expect(document.body).toBeTruthy();
  });
});
