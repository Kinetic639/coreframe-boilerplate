import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: unknown;
    [k: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <div role="menuitem" onClick={onClick} className={className}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
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

vi.mock("@/app/actions/organization/branches", () => ({
  listBranchesAction: vi.fn(),
  createBranchAction: vi.fn(),
  updateBranchAction: vi.fn(),
  deleteBranchAction: vi.fn(),
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
import { listBranchesAction } from "@/app/actions/organization/branches";
import type { OrgMember, OrgRole, OrgBranch } from "@/server/services/organization.service";

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
  initialBranches: [] as OrgBranch[],
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

const branchRole: OrgRole = {
  id: "r-branch",
  name: "Branch Viewer",
  description: null,
  is_basic: false,
  scope_type: "branch",
  permission_slugs: [],
  organization_id: "org-1",
  deleted_at: null,
};

const bothRole: OrgRole = {
  id: "r-both",
  name: "Flexible Role",
  description: null,
  is_basic: false,
  scope_type: "both",
  permission_slugs: [],
  organization_id: "org-1",
  deleted_at: null,
};

const sampleBranch: OrgBranch = {
  id: "b-1",
  organization_id: "org-1",
  name: "Warsaw Branch",
  slug: "warsaw",
  created_at: null,
  deleted_at: null,
};

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
    expect(listBranchesAction).not.toHaveBeenCalled();
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

  // members-4: View link per member row links to member detail page
  it("renders view link for each member", () => {
    setupPermissions(true);
    render(<MembersClient {...emptyProps} initialMembers={[sampleMember]} />, {
      wrapper: createWrapper(),
    });
    const viewLink = screen.getByTitle(/view member details/i);
    expect(viewLink).toBeInTheDocument();
    expect(viewLink.getAttribute("href")).toContain("u-1");
  });

  // members-5: Branch role shows branch badge in Manage Roles dialog
  it("shows branch badge for branch-scoped role in dialog", async () => {
    setupPermissions(true);
    render(
      <MembersClient
        {...emptyProps}
        initialMembers={[sampleMember]}
        initialRoles={[branchRole]}
        initialBranches={[sampleBranch]}
      />,
      { wrapper: createWrapper() }
    );

    // Use the MoreHorizontal trigger button (last button in the row)
    const triggerButtons = screen.getAllByRole("button");
    fireEvent.click(triggerButtons[triggerButtons.length - 1]); // last is the dropdown trigger

    // "Manage Roles" menu item
    const manageRolesItem = await screen.findByText(/manage roles/i);
    fireEvent.click(manageRolesItem);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // Branch badge visible
    expect(screen.getByText("branch")).toBeInTheDocument();
  });

  // members-6: 'both' role shows org/branch toggle when checked
  it("shows scope toggle for both-scoped role when checked in dialog", async () => {
    setupPermissions(true);
    render(
      <MembersClient
        {...emptyProps}
        initialMembers={[sampleMember]}
        initialRoles={[bothRole]}
        initialBranches={[sampleBranch]}
      />,
      { wrapper: createWrapper() }
    );

    // Open manage roles dialog
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    const manageItem = await screen.findByText(/manage roles/i);
    fireEvent.click(manageItem);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Check the 'both' role checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Org/Branch toggle buttons appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Org$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Branch$/i })).toBeInTheDocument();
    });
  });

  // members-7: Branch multiselect appears when branch scope selected for 'both' role
  it("shows branch checkboxes when branch scope selected for both role", async () => {
    setupPermissions(true);
    render(
      <MembersClient
        {...emptyProps}
        initialMembers={[sampleMember]}
        initialRoles={[bothRole]}
        initialBranches={[sampleBranch]}
      />,
      { wrapper: createWrapper() }
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    const manageItem = await screen.findByText(/manage roles/i);
    fireEvent.click(manageItem);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Check the role checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Click "Branch" toggle
    const branchBtn = await screen.findByRole("button", { name: /^Branch$/i });
    fireEvent.click(branchBtn);

    // Branch name appears as a checkbox option
    await waitFor(() => {
      expect(screen.getByText("Warsaw Branch")).toBeInTheDocument();
    });
  });
});
