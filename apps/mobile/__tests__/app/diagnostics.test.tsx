import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { AppBootstrapState, AppState } from "@/contexts/app-context";
import type { HookResult } from "@/lib/queries/types";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";
import type { OrgMembersSummary } from "@/lib/queries/organization/org-members-summary";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterBack = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));

const mockUseAppContext = vi.fn();
vi.mock("@/contexts/app-context", () => ({
  useAppContext: () => mockUseAppContext(),
}));

const mockUseEntitlements = vi.fn();
vi.mock("@/hooks/use-entitlements", () => ({
  useEntitlements: () => mockUseEntitlements(),
}));

const mockUseOrgProfileQuery = vi.fn();
vi.mock("@/hooks/queries/organization/use-org-profile-query", () => ({
  useOrgProfileQuery: () => mockUseOrgProfileQuery(),
}));

const mockUseOrgMembersSummary = vi.fn();
vi.mock("@/hooks/queries/organization/use-org-members-summary", () => ({
  useOrgMembersSummary: () => mockUseOrgMembersSummary(),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_APP_STATE: AppState = {
  userId: "user-abc",
  email: "test@example.com",
  roles: [],
  activeOrgId: "org-123",
  orgRoles: [],
  permissions: { allow: ["tools.read", "members.read"], deny: [] },
  entitlements: {
    organization_id: "org-123",
    plan_id: "plan-pro",
    enabled_modules: ["warehouse", "teams"],
    contexts: [],
    limits: { "warehouse.max_products": 500, "organization.max_users": 25 },
    updated_at: "2026-01-01T00:00:00Z",
  },
  orgName: "Acme Corp",
};

function makeContext(
  bootstrapState: AppBootstrapState = "resolved",
  appState: AppState = BASE_APP_STATE
) {
  return { bootstrapState, appState, retryBootstrap: vi.fn() };
}

function makeEntitlements(entitlements = BASE_APP_STATE.entitlements) {
  return {
    entitlements,
    hasModuleAccess: (slug: string) => entitlements?.enabled_modules.includes(slug) ?? false,
    getEffectiveLimit: (key: string) => entitlements?.limits[key] ?? 0,
  };
}

const ORG_PROFILE_DATA: OrgProfileData = {
  organization_id: "org-123",
  name: "Acme Corp",
  name_2: null,
  slug: "acme-corp",
  bio: null,
  website: "https://acme.example.com",
  logo_url: null,
  theme_color: null,
  font_color: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

// Default hook returns for nominal render
function setupNominalMocks() {
  mockUseAppContext.mockReturnValue(makeContext());
  mockUseEntitlements.mockReturnValue(makeEntitlements());
  mockUseOrgProfileQuery.mockReturnValue({
    kind: "data",
    data: ORG_PROFILE_DATA,
  } satisfies HookResult<OrgProfileData>);
  mockUseOrgMembersSummary.mockReturnValue({
    kind: "data",
    data: { totalMembers: 3 },
  } satisfies HookResult<OrgMembersSummary>);
}

// ─── Import the screen after mocks are declared ───────────────────────────────

// eslint-disable-next-line import/first
import DiagnosticsScreen from "@/app/(app)/(tabs)/diagnostics";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DiagnosticsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNominalMocks();
  });

  // ── 1. Bootstrap state ────────────────────────────────────────────────────
  it("renders the bootstrap state pill", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("resolved")).toBeTruthy();
  });

  // ── 2. Session fields ─────────────────────────────────────────────────────
  it("renders session userId and email", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("user-abc")).toBeTruthy();
    expect(screen.getByText("test@example.com")).toBeTruthy();
  });

  // ── 3. Roles count ────────────────────────────────────────────────────────
  it("renders roles count in section header", () => {
    mockUseAppContext.mockReturnValue(
      makeContext("resolved", {
        ...BASE_APP_STATE,
        roles: [
          {
            role_id: "r1",
            name: "org_owner",
            scope: "org",
            scope_id: "org-123",
            scope_type: "org",
            is_basic: true,
            org_id: "org-123",
            branch_id: null,
            role: "org_owner",
          },
          {
            role_id: "r2",
            name: "org_member",
            scope: "org",
            scope_id: "org-123",
            scope_type: "org",
            is_basic: true,
            org_id: "org-123",
            branch_id: null,
            role: "org_member",
          },
        ],
      })
    );
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    expect(screen.getByText(/Roles \(2\)/)).toBeTruthy();
  });

  // ── 4. Permissions counts ─────────────────────────────────────────────────
  it("renders permissions allow and deny counts in header", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    // BASE_APP_STATE has 2 allow, 0 deny
    expect(screen.getByText(/2 allow, 0 deny/)).toBeTruthy();
  });

  // ── 5. All allow slugs visible ────────────────────────────────────────────
  it("renders all allow permission slugs", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("members.read")).toBeTruthy();
    expect(screen.getByText("tools.read")).toBeTruthy();
  });

  // ── 6. Entitlements raw — plan_id ─────────────────────────────────────────
  it("renders raw entitlements plan_id", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("plan-pro")).toBeTruthy();
  });

  // ── 7. Null entitlements ──────────────────────────────────────────────────
  it("renders 'No entitlements loaded' when entitlements is null", () => {
    mockUseAppContext.mockReturnValue(
      makeContext("resolved", { ...BASE_APP_STATE, entitlements: null })
    );
    mockUseEntitlements.mockReturnValue(makeEntitlements(null));
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("No entitlements loaded")).toBeTruthy();
  });

  // ── 8. Entitlements interpreted — module access ───────────────────────────
  it("renders interpreted module access rows", () => {
    // BASE entitlements has warehouse and teams enabled
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    // warehouse enabled → "✓ yes"
    const yesMatches = screen.getAllByText("✓ yes");
    expect(yesMatches.length).toBeGreaterThanOrEqual(1);
    // organization-management not in enabled_modules → "– no"
    const noMatches = screen.getAllByText("– no");
    expect(noMatches.length).toBeGreaterThanOrEqual(1);
  });

  // ── 9. Organization section — data state ──────────────────────────────────
  it("renders org profile name and slug when query returns data", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    // "Acme Corp" appears twice: once in Session (orgName) and once in Org section (profile.name)
    const nameMatches = screen.getAllByText("Acme Corp");
    expect(nameMatches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("acme-corp")).toBeTruthy();
  });

  // ── 10. Organization section — loading state ──────────────────────────────
  it("renders loading placeholder when org profile query is loading", () => {
    mockUseOrgProfileQuery.mockReturnValue({
      kind: "loading",
    } satisfies HookResult<OrgProfileData>);
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("Loading profile…")).toBeTruthy();
  });

  // ── 11. Live Query Health — kind pills ────────────────────────────────────
  it("renders kind pills for both hooks in live query health section", () => {
    // Both return kind=data in nominal setup.
    // The screen renders "data" pill twice (org profile + members summary).
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    const dataPills = screen.getAllByText("data");
    // At minimum 2: one per health-table row (orgProfile and membersSummary)
    expect(dataPills.length).toBeGreaterThanOrEqual(2);
  });

  // ── 12. Collapse/expand interaction ──────────────────────────────────────
  it("collapses a section when its header is tapped and re-expands on second tap", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });

    // "Bootstrap State" section header — content ("resolved" pill) is visible initially
    expect(screen.getByText("resolved")).toBeTruthy();

    // Tap the Bootstrap State section header to collapse it.
    // The mock renders TouchableOpacity as <button aria-label="...">
    const bootstrapHeader = screen.getByRole("button", { name: "Collapse Bootstrap State" });
    fireEvent.click(bootstrapHeader);

    // After collapse: header label flips to "Expand …"
    expect(screen.getByRole("button", { name: "Expand Bootstrap State" })).toBeTruthy();

    // Tap again to re-expand
    fireEvent.click(screen.getByRole("button", { name: "Expand Bootstrap State" }));
    expect(screen.getByRole("button", { name: "Collapse Bootstrap State" })).toBeTruthy();
  });

  // ── 13. Back button calls router.back ─────────────────────────────────────
  it("calls router.back when the back button is pressed", () => {
    render(<DiagnosticsScreen />, { wrapper: createWrapper() });
    const backBtn = screen.getByRole("button", { name: "Go back" });
    fireEvent.click(backBtn);
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
