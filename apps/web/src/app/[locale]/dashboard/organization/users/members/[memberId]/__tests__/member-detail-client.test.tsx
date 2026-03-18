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
    href: string;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/app/actions/organization/roles", () => ({
  listRolesAction: vi.fn(),
  assignRoleToUserAction: vi.fn(),
  removeRoleFromUserAction: vi.fn(),
  getMemberAccessAction: vi.fn(),
  createRoleAction: vi.fn(),
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

import { MemberDetailClient } from "../_components/member-detail-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import type {
  OrgMember,
  OrgMemberAccess,
  OrgRole,
  OrgBranch,
} from "@/server/services/organization.service";

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

function setupPermissions(canManage = true, canRead = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: (perm: string) => {
      if (perm === "members.manage") return canManage;
      if (perm === "members.read") return canRead;
      return canRead;
    },
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

const sampleMember: OrgMember = {
  id: "m-1",
  user_id: "u-1",
  organization_id: "org-1",
  status: "active",
  joined_at: "2024-01-01T00:00:00Z",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  user_email: "alice@example.com",
  user_first_name: "Alice",
  user_last_name: "Smith",
  user_avatar_url: null,
  roles: [],
};

const emptyAccess: OrgMemberAccess = {
  user_id: "u-1",
  assignments: [],
};

const accessWithOrgRole: OrgMemberAccess = {
  user_id: "u-1",
  assignments: [
    {
      id: "a-1",
      role_id: "r-1",
      role_name: "Editor",
      role_is_basic: false,
      role_scope_type: "org",
      scope: "org",
      scope_id: "org-1",
      branch_name: null,
    },
  ],
};

const accessWithBranchRole: OrgMemberAccess = {
  user_id: "u-1",
  assignments: [
    {
      id: "a-2",
      role_id: "r-2",
      role_name: "Branch Viewer",
      role_is_basic: false,
      role_scope_type: "branch",
      scope: "branch",
      scope_id: "b-1",
      branch_name: "Warsaw Branch",
    },
  ],
};

const sampleRole: OrgRole = {
  id: "r-1",
  name: "Editor",
  description: null,
  is_basic: false,
  scope_type: "org",
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

describe("MemberDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // detail-1: Member name renders from member prop
  it("renders member display name", () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  // detail-2: Back link rendered
  it("renders back link to members list", () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText(/back to members/i)).toBeInTheDocument();
  });

  // detail-3: Empty state in Access tab when no assignments
  it("shows empty state in access tab when no assignments", () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText(/no role assignments found/i)).toBeInTheDocument();
  });

  // detail-4: Org-scoped assignment shows 'org' scope badge
  it("renders org scope badge for org-scoped assignment", () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={accessWithOrgRole}
        initialRoles={[]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("org")).toBeInTheDocument();
  });

  // detail-5: Branch-scoped assignment shows branch name in badge
  it("renders branch name in scope badge for branch-scoped assignment", () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={accessWithBranchRole}
        initialRoles={[]}
        initialBranches={[sampleBranch]}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText("Branch Viewer")).toBeInTheDocument();
    expect(screen.getByText("Warsaw Branch")).toBeInTheDocument();
  });

  // detail-6: Add Role + Custom Access buttons visible when canManage
  it("renders Add Role and Custom Access buttons when user can manage", () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[sampleRole]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByRole("button", { name: /add role/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /custom access/i })).toBeInTheDocument();
  });

  // detail-7: Add Role + Custom Access buttons absent when lacks manage
  it("hides management buttons when user lacks manage permission", () => {
    setupPermissions(false);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[sampleRole]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.queryByRole("button", { name: /add role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /custom access/i })).not.toBeInTheDocument();
  });

  // detail-8: Add Role dialog opens and shows available roles
  it("opens add role dialog with available roles", async () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[sampleRole]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole("button", { name: /add role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  // detail-9: Branch selector appears for branch-scoped role in Add Role dialog
  it("shows branch selector when branch-scoped role selected in add dialog", async () => {
    setupPermissions(true);
    const branchRole: OrgRole = {
      ...sampleRole,
      id: "r-branch",
      name: "Branch Manager",
      scope_type: "branch",
    };
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[branchRole]}
        initialBranches={[sampleBranch]}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole("button", { name: /add role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Select the branch role
    fireEvent.click(screen.getByText("Branch Manager"));

    // Branch selector appears
    await waitFor(() => {
      expect(screen.getByText("Warsaw Branch")).toBeInTheDocument();
    });
  });

  // detail-10: Custom Access dialog opens and shows permission options
  it("opens custom access dialog with permission checkboxes", async () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole("button", { name: /custom access/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    expect(screen.getByText(/view members/i)).toBeInTheDocument();
    expect(screen.getByText(/send invitations/i)).toBeInTheDocument();
  });

  // detail-11: Custom Access dialog groups permissions by category (P1)
  it("custom access dialog renders grouped permission headings", async () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole("button", { name: /custom access/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector(".max-h-52")).toBeNull(); // no scroll container
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Invitations")).toBeInTheDocument();
    expect(screen.getByText("Branches")).toBeInTheDocument();
  });

  // detail-12: Custom Access dialog uses correct permission slugs (not invitations.X) (P2 bug fix)
  it("custom access dialog permission slugs use invites.* not invitations.*", async () => {
    setupPermissions(true);
    render(
      <MemberDetailClient
        member={sampleMember}
        initialAccess={emptyAccess}
        initialRoles={[]}
        initialBranches={[]}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole("button", { name: /custom access/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Correct slugs visible as mono labels
    expect(screen.getByText("invites.read")).toBeInTheDocument();
    expect(screen.getByText("invites.create")).toBeInTheDocument();
    expect(screen.getByText("invites.cancel")).toBeInTheDocument();
    // Old wrong slugs must NOT appear
    expect(screen.queryByText("invitations.read")).not.toBeInTheDocument();
    expect(screen.queryByText("invitations.create")).not.toBeInTheDocument();
    expect(screen.queryByText("invitations.cancel")).not.toBeInTheDocument();
  });
});
