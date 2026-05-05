import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: unknown }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

vi.mock("@/hooks/v2/use-permissions", () => ({ usePermissions: vi.fn() }));
vi.mock("@/lib/stores/v2/app-store", () => ({ useAppStoreV2: () => "org-1" }));

vi.mock("@/hooks/queries/organization", () => ({
  useMembersQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  usePositionsQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useAssignmentsQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useRolesQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useBranchesQuery: (d: unknown) => ({ data: Array.isArray(d) ? d : [] }),
  useMembersRealtimeSync: vi.fn(),
  useUpdateMemberStatusMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveMemberMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useAssignRoleToUserMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveRoleFromUserMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssignPositionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemovePositionAssignmentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

import { MembersClient } from "../_components/members-client";
import { usePermissions } from "@/hooks/v2/use-permissions";
import type { OrgMember, OrgBranch } from "@/server/services/organization.service";
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

const sampleMember: OrgMember = {
  id: "m-1",
  organization_id: "org-1",
  user_id: "u-1",
  status: "active",
  joined_at: null,
  created_at: null,
  updated_at: null,
  user_email: "alice@example.com",
  user_first_name: "Alice",
  user_last_name: "Smith",
  user_avatar_url: null,
  roles: [],
};

const sampleBranch: OrgBranch = {
  id: "b-1",
  organization_id: "org-1",
  name: "Warsaw",
  slug: "warsaw",
  created_at: null,
  deleted_at: null,
};

function makeInitialData(members: OrgMember[] = []): PaginatedResult<OrgMember> {
  return { rows: members, totalCount: members.length, page: 1, pageSize: 50 };
}

function renderClient(members: OrgMember[] = [], branches: OrgBranch[] = []) {
  return render(
    <MembersClient
      initialData={makeInitialData(members)}
      allMembers={members}
      initialPositions={[]}
      initialAssignments={[]}
      initialRoles={[]}
      initialBranches={branches}
    />,
    { wrapper: createWrapper() }
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MembersClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // members-1: renders the page title from translations
  it("renders title from translations", () => {
    setupPermissions(true);
    renderClient();
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  // members-2: renders without crashing with member data
  it("renders without crashing with member data", () => {
    setupPermissions(true);
    renderClient([sampleMember]);
    expect(document.body).toBeTruthy();
  });

  // members-3: renders without crashing when canManage is false
  it("renders without crashing when canManage is false", () => {
    setupPermissions(false);
    renderClient([sampleMember]);
    expect(document.body).toBeTruthy();
  });

  // members-4: renders with branches passed as initial data
  it("renders with branches in initial data", () => {
    setupPermissions(true);
    renderClient([sampleMember], [sampleBranch]);
    expect(document.body).toBeTruthy();
  });
});
