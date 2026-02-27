import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/app/actions/organization/members", () => ({
  listMembersAction: vi.fn(),
  updateMemberStatusAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));

vi.mock("@/app/actions/organization/positions", () => ({
  listPositionsAction: vi.fn(),
  listPositionAssignmentsAction: vi.fn(),
  assignPositionAction: vi.fn(),
  removePositionAssignmentAction: vi.fn(),
}));

vi.mock("@/app/actions/organization/roles", () => ({
  listRolesAction: vi.fn(),
  assignRoleToUserAction: vi.fn(),
  removeRoleFromUserAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { MembersClient } from "../_components/members-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { listMembersAction } from "@/app/actions/organization/members";
import {
  listPositionsAction,
  listPositionAssignmentsAction,
} from "@/app/actions/organization/positions";
import { listRolesAction } from "@/app/actions/organization/roles";
import type { OrgMember } from "@/server/services/organization.service";

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

function setupPermissions(canManage = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: () => canManage,
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

const emptyProps = {
  initialMembers: [] as OrgMember[],
  initialPositions: [],
  initialAssignments: [],
  initialRoles: [],
};

const sampleMember = {
  id: "m-1",
  user_id: "u-1",
  organization_id: "org-1",
  status: "active",
  user_email: "alice@example.com",
  user_first_name: "Alice",
  user_last_name: "Smith",
  user_avatar_url: null,
  roles: [],
} as unknown as OrgMember;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MembersClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // members-1: List actions NOT called on mount (SSR provides initial data)
  it("does not call list actions on mount", () => {
    setupPermissions(true);
    render(<MembersClient {...emptyProps} />, { wrapper: createWrapper() });
    expect(listMembersAction).not.toHaveBeenCalled();
    expect(listPositionsAction).not.toHaveBeenCalled();
    expect(listPositionAssignmentsAction).not.toHaveBeenCalled();
    expect(listRolesAction).not.toHaveBeenCalled();
  });

  // members-2: Empty state message renders when no members
  it("shows empty state when member list is empty", () => {
    setupPermissions(true);
    render(<MembersClient {...emptyProps} />, { wrapper: createWrapper() });
    expect(screen.getByText(/no members found/i)).toBeInTheDocument();
  });

  // members-3: Member name renders immediately from initialMembers (no fetch)
  it("renders member name from initialMembers without fetching", () => {
    setupPermissions(true);
    render(<MembersClient {...emptyProps} initialMembers={[sampleMember]} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(listMembersAction).not.toHaveBeenCalled();
  });
});
