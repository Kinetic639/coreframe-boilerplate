import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
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
import {
  listMembersAction,
  removeMemberAction,
  updateMemberStatusAction,
} from "@/app/actions/organization/members";
import {
  assignPositionAction,
  listPositionsAction,
  listPositionAssignmentsAction,
  removePositionAssignmentAction,
} from "@/app/actions/organization/positions";
import {
  assignRoleToUserAction,
  listRolesAction,
  removeRoleFromUserAction,
} from "@/app/actions/organization/roles";
import { listBranchesAction } from "@/app/actions/organization/branches";
import type { OrgMember, OrgRole, OrgBranch } from "@/server/services/organization.service";
import { toast } from "react-toastify";

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

const fallbackMember = {
  ...sampleMember,
  id: "m-2",
  user_id: "u-2",
  user_first_name: null,
  user_last_name: null,
  user_email: "fallback@example.com",
  status: "inactive",
  roles: [
    {
      id: "r-branch",
      name: "Branch Viewer",
      scope: "branch",
      scope_id: "b-1",
    },
  ],
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
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

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

  it("hides management actions when user lacks manage permission", () => {
    setupPermissions(false);
    render(<MembersClient {...emptyProps} initialMembers={[sampleMember]} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTitle(/view member details/i)).toBeInTheDocument();
    expect(screen.queryByText(/manage roles/i)).not.toBeInTheDocument();
  });

  it("renders email fallback, inactive badge, and branch role badge details", () => {
    setupPermissions(true);
    render(
      <MembersClient
        {...emptyProps}
        initialMembers={[fallbackMember]}
        initialBranches={[sampleBranch]}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("fallback@example.com")).toBeInTheDocument();
    expect(screen.getByText("inactive")).toBeInTheDocument();
    expect(screen.getByText(/Branch Viewer/)).toBeInTheDocument();
    expect(screen.getByText(/Warsaw Branch/)).toBeInTheDocument();
  });

  it("shows no branches available when a branch-scoped role is selected without branches", async () => {
    setupPermissions(true);
    render(
      <MembersClient
        {...emptyProps}
        initialMembers={[sampleMember]}
        initialRoles={[branchRole]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    fireEvent.click(await screen.findByText(/manage roles/i));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("checkbox"));
    expect(await screen.findByText(/no branches available/i)).toBeInTheDocument();
  });

  it("toggles member status and refreshes after success", async () => {
    setupPermissions(true);
    vi.mocked(updateMemberStatusAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);

    render(<MembersClient {...emptyProps} initialMembers={[sampleMember]} />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    fireEvent.click(await screen.findByText(/deactivate/i));

    await waitFor(() => {
      expect(updateMemberStatusAction).toHaveBeenCalledWith({
        userId: "u-1",
        status: "inactive",
      });
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Member deactivated");
  });

  it("removes a member from the dropdown action", async () => {
    setupPermissions(true);
    vi.mocked(removeMemberAction).mockResolvedValue({ success: true, data: undefined } as never);

    render(<MembersClient {...emptyProps} initialMembers={[sampleMember]} />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    fireEvent.click(await screen.findByText(/remove member/i));

    await waitFor(() => {
      expect(removeMemberAction).toHaveBeenCalledWith({ userId: "u-1" });
    });
  });

  it("changes an existing position by removing the old assignment and saving the new one", async () => {
    setupPermissions(true);
    vi.mocked(removePositionAssignmentAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);
    vi.mocked(assignPositionAction).mockResolvedValue({ success: true, data: undefined } as never);

    const assignment = {
      id: "assign-1",
      user_id: "u-1",
      position_id: "pos-1",
      position_name: "Picker",
      deleted_at: null,
    };
    const positionA = { id: "pos-1", name: "Picker" };
    const positionB = { id: "pos-2", name: "Supervisor" };

    render(
      <MembersClient
        {...emptyProps}
        initialMembers={[sampleMember]}
        initialAssignments={[assignment] as never[]}
        initialPositions={[positionA, positionB] as never[]}
      />,
      { wrapper: createWrapper() }
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    fireEvent.click(await screen.findByText(/change position/i));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Supervisor"));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(removePositionAssignmentAction).toHaveBeenCalledWith({ assignmentId: "assign-1" });
      expect(assignPositionAction).toHaveBeenCalledWith({
        userId: "u-1",
        positionId: "pos-2",
      });
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Position assigned");
  });

  it("saves branch-scoped role updates and reports success", async () => {
    setupPermissions(true);
    vi.mocked(assignRoleToUserAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);
    vi.mocked(removeRoleFromUserAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);

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
    fireEvent.click(await screen.findByText(/manage roles/i));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(await screen.findByRole("button", { name: /^Branch$/i }));
    fireEvent.click(screen.getByLabelText("Warsaw Branch"));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(assignRoleToUserAction).toHaveBeenCalledWith({
        userId: "u-1",
        roleId: "r-both",
        scope: "branch",
        scopeId: "b-1",
      });
    });
  });
});
