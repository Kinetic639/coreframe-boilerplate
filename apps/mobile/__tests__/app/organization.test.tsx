import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { AppState } from "@/contexts/app-context";
import type { HookResult } from "@/lib/queries/types";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";
import type { OrgMemberItem } from "@/hooks/queries/organization/use-org-members-list";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterBack = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockRouterBack, push: mockRouterPush }),
}));

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockUseAppContext = vi.fn();
vi.mock("@/contexts/app-context", () => ({
  useAppContext: () => mockUseAppContext(),
}));

const mockUseOrgProfileQuery = vi.fn();
vi.mock("@/hooks/queries/organization/use-org-profile-query", () => ({
  useOrgProfileQuery: () => mockUseOrgProfileQuery(),
}));

const mockUseOrgMembersList = vi.fn();
vi.mock("@/hooks/queries/organization/use-org-members-list", () => ({
  useOrgMembersList: () => mockUseOrgMembersList(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_APP_STATE: AppState = {
  userId: "user-1",
  email: "user@example.com",
  roles: [],
  activeOrgId: "org-1",
  orgRoles: [],
  activeBranchId: null,
  branchRoles: [],
  branchPermissions: null,
  orgName: "Acme Corp",
  orgName2: null,
  permissions: { allow: ["members.read"], deny: [] },
  entitlements: null,
};

const ORG_PROFILE: OrgProfileData = {
  organization_id: "org-1",
  name: "Acme Corp",
  name_2: null,
  slug: "acme-corp",
  bio: null,
  website: "https://acme.example.com",
  logo_url: null,
  theme_color: null,
  font_color: null,
};

const MEMBERS: OrgMemberItem[] = [
  {
    userId: "u1",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Smith",
    avatarUrl: null,
    joinedAt: "2026-01-01T00:00:00Z",
  },
  {
    userId: "u2",
    email: "bob@example.com",
    firstName: "Bob",
    lastName: "Jones",
    avatarUrl: null,
    joinedAt: "2026-01-02T00:00:00Z",
  },
];

function makeContext(appState: AppState = BASE_APP_STATE) {
  return { bootstrapState: "resolved" as const, appState, retryBootstrap: vi.fn() };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

function setupNominalMocks() {
  mockUseAppContext.mockReturnValue(makeContext());
  mockUseOrgProfileQuery.mockReturnValue({
    kind: "data",
    data: ORG_PROFILE,
  } satisfies HookResult<OrgProfileData>);
  mockUseOrgMembersList.mockReturnValue({
    kind: "data",
    data: MEMBERS,
  } satisfies HookResult<OrgMemberItem[]>);
}

// ─── Import screen after mocks ────────────────────────────────────────────────

// eslint-disable-next-line import/first
import OrganizationScreen from "@/app/(app)/organization/index";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OrganizationScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNominalMocks();
  });

  // ── 1. Org name from profile query ────────────────────────────────────────
  it("renders org name from profile query data", () => {
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    // Name appears in card (profile.name) and optionally header — getAllByText is safe
    const matches = screen.getAllByText("Acme Corp");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. Member rows ────────────────────────────────────────────────────────
  it("renders member display names from members list", () => {
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.getByText("Bob Jones")).toBeTruthy();
  });

  // ── 3. Loading state for profile ──────────────────────────────────────────
  it("renders loading placeholder when org profile query is loading", () => {
    mockUseOrgProfileQuery.mockReturnValue({
      kind: "loading",
    } satisfies HookResult<OrgProfileData>);
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("Ładowanie profilu…")).toBeTruthy();
  });

  // ── 4. Empty members ──────────────────────────────────────────────────────
  it("renders empty state when member list is empty", () => {
    mockUseOrgMembersList.mockReturnValue({
      kind: "empty",
    } satisfies HookResult<OrgMemberItem[]>);
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("Brak członków")).toBeTruthy();
  });

  // ── 5. Back button ────────────────────────────────────────────────────────
  it("calls router.back when back button is pressed", () => {
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    const backBtn = screen.getByRole("button", { name: "Go back" });
    fireEvent.click(backBtn);
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // ── 6. Edit button shown when user has org.update ─────────────────────────
  it("renders edit button when user has org.update permission", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({
        ...BASE_APP_STATE,
        permissions: { allow: ["org.update"], deny: [] },
      })
    );
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: "Edit organization profile" })).toBeTruthy();
  });

  // ── 7. Edit button hidden without org.update ──────────────────────────────
  it("does not render edit button when user lacks org.update permission", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({
        ...BASE_APP_STATE,
        permissions: { allow: [], deny: [] },
      })
    );
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    expect(screen.queryByRole("button", { name: "Edit organization profile" })).toBeNull();
  });

  // ── 8. Edit button navigates to edit screen ───────────────────────────────
  it("navigates to edit screen when edit button is pressed", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({
        ...BASE_APP_STATE,
        permissions: { allow: ["org.update"], deny: [] },
      })
    );
    render(<OrganizationScreen />, { wrapper: createWrapper() });
    const editBtn = screen.getByRole("button", { name: "Edit organization profile" });
    fireEvent.click(editBtn);
    expect(mockRouterPush).toHaveBeenCalledWith("/(app)/organization/edit");
  });
});
