import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({ usePermissions: vi.fn() }));

vi.mock("@/hooks/queries/organization", () => ({
  useRolesQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useCreateRoleMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateRoleMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteRoleMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

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

import { RolesClient } from "../_components/roles-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import type { OrgRole } from "@/server/services/organization.service";
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

function setupPermissions(canManage = true) {
  vi.mocked(usePermissions).mockReturnValue({
    can: (p: string) => (p === "members.manage" ? canManage : false),
    cannot: vi.fn(),
    canAny: vi.fn(),
    canAll: vi.fn(),
    getSnapshot: vi.fn(),
  } as unknown as ReturnType<typeof usePermissions>);
}

const sampleRole: OrgRole = {
  id: "role-1",
  organization_id: "org-1",
  name: "Manager",
  description: "Branch manager",
  is_basic: false,
  scope_type: "org",
  deleted_at: null,
  permission_slugs: ["branches.read"],
};

function makeInitialData(roles: OrgRole[] = []): PaginatedResult<OrgRole> {
  return { rows: roles, totalCount: roles.length, page: 1, pageSize: 50 };
}

function renderClient(roles: OrgRole[] = []) {
  return render(<RolesClient initialData={makeInitialData(roles)} allRoles={roles} />, {
    wrapper: createWrapper(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RolesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // roles-1: Create Role button visible when user has members.manage
  it("renders Create Role button when user has members.manage", () => {
    setupPermissions(true);
    renderClient();
    expect(screen.getByRole("button", { name: /createButton/i })).toBeInTheDocument();
  });

  // roles-2: Create Role button hidden when user lacks members.manage
  it("hides Create Role button when user lacks members.manage", () => {
    setupPermissions(false);
    renderClient();
    expect(screen.queryByRole("button", { name: /createButton/i })).not.toBeInTheDocument();
  });

  // roles-3: Dialog opens when Create Role is clicked
  it("opens create dialog when Create Role is clicked", async () => {
    setupPermissions(true);
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /createButton/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  // roles-4: Renders without crashing with role data
  it("renders without crashing with role data", () => {
    setupPermissions(true);
    renderClient([sampleRole]);
    expect(document.body).toBeTruthy();
  });
});
