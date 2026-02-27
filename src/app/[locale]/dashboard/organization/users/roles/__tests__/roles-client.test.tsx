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

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { RolesClient } from "../_components/roles-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { listRolesAction, createRoleAction } from "@/app/actions/organization/roles";

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
});
