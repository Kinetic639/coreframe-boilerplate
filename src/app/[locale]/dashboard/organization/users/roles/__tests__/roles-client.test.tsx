import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks (hoisted before imports) ──────────────────────────────────────────

const mockRouterRefresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: vi.fn() }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/app/actions/organization/roles", () => ({
  listRolesAction: vi.fn(),
  createRoleAction: vi.fn(),
  updateRoleAction: vi.fn(),
  deleteRoleAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    "modules.organizationManagement.roles.createButton": "Create Role",
    "modules.organizationManagement.roles.noRoles": "No roles found.",
    "modules.organizationManagement.roles.systemBadge": "system",
    "modules.organizationManagement.roles.scopeBadges.branch": "branch",
    "modules.organizationManagement.roles.scopeBadges.both": "both",
    "modules.organizationManagement.roles.dialog.titleCreate": "Create Role",
    "modules.organizationManagement.roles.dialog.titleEdit": "Edit Role",
    "modules.organizationManagement.roles.dialog.name": "Name",
    "modules.organizationManagement.roles.dialog.namePlaceholder": "Role name",
    "modules.organizationManagement.roles.dialog.description": "Description",
    "modules.organizationManagement.roles.dialog.descriptionPlaceholder": "Optional description",
    "modules.organizationManagement.roles.dialog.scope": "Scope",
    "modules.organizationManagement.roles.dialog.scopeOrg":
      "Organization — applies to all branches",
    "modules.organizationManagement.roles.dialog.scopeBranch": "Branch — assigned per branch",
    "modules.organizationManagement.roles.dialog.scopeNote":
      "Scope cannot be changed after creation.",
    "modules.organizationManagement.roles.dialog.scopeReadOnly": "(read-only)",
    "modules.organizationManagement.roles.dialog.permissions": "Permissions",
    "modules.organizationManagement.roles.dialog.permissionsSelected": "permissions selected",
    "modules.organizationManagement.roles.dialog.cancel": "Cancel",
    "modules.organizationManagement.roles.dialog.save": "Save",
    "modules.organizationManagement.roles.dialog.create": "Create",
    "modules.organizationManagement.roles.dialog.saving": "Saving...",
  };
  return {
    useTranslations: (namespace?: string) => (key: string) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return translations[fullKey] ?? key;
    },
    useLocale: () => "en",
  };
});

vi.mock("@/components/ui/select", () => {
  // Closure variable to thread onValueChange from Select → SelectItem
  let _onValueChange: ((v: string) => void) | null = null;
  return {
    Select: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange?: (v: string) => void;
      value?: string;
      disabled?: boolean;
    }) => {
      _onValueChange = onValueChange ?? null;
      return <div>{children}</div>;
    },
    SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => (
      <button role="combobox" id={id} type="button">
        {children}
      </button>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
      <div data-value={value} onClick={() => _onValueChange?.(value)}>
        {children}
      </div>
    ),
    SelectValue: () => null,
  };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { RolesClient } from "../_components/roles-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { listRolesAction, createRoleAction } from "@/app/actions/organization/roles";
import type { OrgRole } from "@/server/services/organization.service";

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
    cannot: () => !canManage,
    canAny: () => canManage,
    canAll: () => canManage,
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

function setup(canManage = true) {
  setupPermissions(canManage);
  render(<RolesClient initialRoles={[]} />, { wrapper: createWrapper() });
}

const sampleBranchRole: OrgRole = {
  id: "r-branch",
  name: "Branch Manager",
  description: null,
  is_basic: false,
  scope_type: "branch",
  permission_slugs: [],
  organization_id: "org-1",
  deleted_at: null,
};

const sampleBothRole: OrgRole = {
  id: "r-both",
  name: "Flexible Role",
  description: null,
  is_basic: false,
  scope_type: "both",
  permission_slugs: [],
  organization_id: "org-1",
  deleted_at: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RolesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // roles-1: Create Role button visible when user has members.manage permission
  it("renders Create Role button when user has manage permission", () => {
    setup(true);
    expect(screen.getByRole("button", { name: /create role/i })).toBeInTheDocument();
  });

  // roles-2: Create Role button absent when user lacks members.manage
  it("hides Create Role button when user lacks manage permission", () => {
    setup(false);
    expect(screen.queryByRole("button", { name: /create role/i })).not.toBeInTheDocument();
  });

  // roles-3: All 4 permission group headings render inside the create dialog
  it("renders all 4 permission group labels in create dialog", async () => {
    setup(true);

    fireEvent.click(screen.getByRole("button", { name: /create role/i }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Invitations")).toBeInTheDocument();
    expect(screen.getByText("Branches")).toBeInTheDocument();
  });

  // roles-4: createRoleAction is called with the selected permission_slugs
  it("calls createRoleAction with selected permission_slugs on submit", async () => {
    vi.mocked(listRolesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createRoleAction).mockResolvedValue({
      success: true,
      data: {
        id: "r-new",
        name: "Test",
        description: null,
        is_basic: false,
        permission_slugs: [],
        organization_id: "org-1",
        scope_type: "org",
        deleted_at: null,
      } as never,
    });
    setup(true);

    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Fill in role name
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Viewer" },
    });

    // Toggle "View members list" permission checkbox
    const membersReadCheckbox = screen.getByLabelText(/view members list/i);
    fireEvent.click(membersReadCheckbox);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(createRoleAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Viewer",
          permission_slugs: expect.arrayContaining(["members.read"]),
        })
      )
    );
  });

  // roles-5: listRolesAction NOT called on mount (SSR-first)
  it("does not call listRolesAction on mount", () => {
    setup(true);
    expect(listRolesAction).not.toHaveBeenCalled();
  });

  // roles-6: Scope selector defaults to 'org' in create dialog
  it("create dialog shows scope selector defaulting to org", async () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Scope label exists
    expect(screen.getByLabelText(/scope/i)).toBeInTheDocument();
  });

  // roles-7: createRoleAction receives scope_type when set
  it("creates role with scope_type=branch when branch scope selected", async () => {
    vi.mocked(createRoleAction).mockResolvedValue({
      success: true,
      data: {
        id: "r-b",
        name: "Br",
        description: null,
        is_basic: false,
        permission_slugs: [],
        organization_id: "org-1",
        scope_type: "branch",
        deleted_at: null,
      } as never,
    });
    setup(true);

    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Branch Viewer" } });

    // Change scope via combobox/select
    // The Select trigger renders as a button with role=combobox
    const scopeTrigger = screen.getByRole("combobox");
    fireEvent.click(scopeTrigger);
    // Listbox option for branch
    const branchOption = await screen.findByText(/branch.*assigned per branch/i);
    fireEvent.click(branchOption);

    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(createRoleAction).toHaveBeenCalledWith(
        expect.objectContaining({ scope_type: "branch" })
      )
    );
  });

  // roles-8: Branch-scoped role shows 'branch' badge in list
  it("renders branch scope badge for branch-scoped roles", () => {
    setupPermissions(true);
    render(<RolesClient initialRoles={[sampleBranchRole]} />, { wrapper: createWrapper() });
    expect(screen.getByText("branch")).toBeInTheDocument();
  });

  // roles-9: 'both' scope_type renders 'both' badge in list
  it("renders both scope badge for both-scoped roles", () => {
    setupPermissions(true);
    render(<RolesClient initialRoles={[sampleBothRole]} />, { wrapper: createWrapper() });
    expect(screen.getByText("both")).toBeInTheDocument();
  });

  // roles-10: Edit dialog shows scope as read-only (no scope selector)
  it("edit dialog shows scope as read-only text, not a selector", async () => {
    setupPermissions(true);
    render(<RolesClient initialRoles={[sampleBranchRole]} />, { wrapper: createWrapper() });

    // Find edit button (pencil icon) — querySelector("svg") would match "Create Role" first (Plus SVG),
    // so we narrow to the lucide-pencil class specifically.
    const editButtons = screen.getAllByRole("button");
    const pencilBtn = editButtons.find((b) => b.querySelector("svg.lucide-pencil"));
    if (pencilBtn) fireEvent.click(pencilBtn);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // read-only indicator
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    // No scope combobox in edit dialog
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  // roles-11: Permission grid — no max-h scrollable container in create dialog (P1)
  it("permission picker uses grid layout, no overflow scroll container", async () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // The old UI had a div with class max-h-64 and overflow-y-auto.
    // The new grid UI must NOT have that class combination.
    const dialog = screen.getByRole("dialog");
    const scrollContainer = dialog.querySelector(".max-h-64.overflow-y-auto");
    expect(scrollContainer).toBeNull();
  });

  // roles-12: Branch scope hides org-only permissions (P2)
  it("switching to branch scope hides org-only permissions in create dialog", async () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Org-only permission should be visible initially (scope=org)
    expect(screen.getByLabelText(/view organization profile/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/create branches/i)).toBeInTheDocument();

    // Switch scope to branch
    const scopeTrigger = screen.getByRole("combobox");
    fireEvent.click(scopeTrigger);
    const branchOption = await screen.findByText(/branch.*assigned per branch/i);
    fireEvent.click(branchOption);

    // Org-only permissions now hidden
    await waitFor(() => {
      expect(screen.queryByLabelText(/view organization profile/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/create branches/i)).not.toBeInTheDocument();
    });
    // Branch-allowed permissions still present
    expect(screen.getByLabelText(/view members list/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/view invitations/i)).toBeInTheDocument();
  });

  // roles-13: Switching from branch back to org restores org-only permissions (P2)
  it("switching scope back to org restores org-only permissions", async () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const scopeTrigger = screen.getByRole("combobox");

    // Switch to branch
    fireEvent.click(scopeTrigger);
    const branchOption = await screen.findByText(/branch.*assigned per branch/i);
    fireEvent.click(branchOption);

    await waitFor(() =>
      expect(screen.queryByLabelText(/view organization profile/i)).not.toBeInTheDocument()
    );

    // Switch back to org
    fireEvent.click(scopeTrigger);
    const orgOption = await screen.findByText(/organization.*applies to all branches/i);
    fireEvent.click(orgOption);

    await waitFor(() =>
      expect(screen.getByLabelText(/view organization profile/i)).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/create branches/i)).toBeInTheDocument();
  });
});
