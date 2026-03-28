import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import type { AppState } from "@/contexts/app-context";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@repo/contracts/modules";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockUseAppContext = vi.fn();
vi.mock("@/contexts/app-context", () => ({
  useAppContext: () => mockUseAppContext(),
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
  accessibleBranchIds: [],
  branchPermissions: null,
  orgName: "Acme Corp",
  orgName2: null,
  permissions: {
    allow: ["module.organization-management.access", "members.read"],
    deny: [],
  },
  entitlements: {
    organization_id: "org-1",
    plan_id: "plan-pro",
    enabled_modules: [MODULE_ORGANIZATION_MANAGEMENT],
    contexts: [],
    limits: {},
    updated_at: "2026-01-01T00:00:00Z",
  },
};

function makeContext(overrides: Partial<AppState> = {}) {
  return {
    bootstrapState: "resolved" as const,
    appState: { ...BASE_APP_STATE, ...overrides },
    retryBootstrap: vi.fn(),
    switchBranch: vi.fn(),
  };
}

// ─── Import screen after mocks ────────────────────────────────────────────────

// eslint-disable-next-line import/first
import LauncherScreen from "@/app/(app)/(tabs)/index";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LauncherScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppContext.mockReturnValue(makeContext());
  });

  // ── 1. Tile visible when access granted ───────────────────────────────────
  it("renders org-management tile when entitlement and permission are present", () => {
    render(<LauncherScreen />);
    expect(screen.getByText("Organizacja")).toBeTruthy();
  });

  // ── 2. Empty state when entitlements null ─────────────────────────────────
  it("renders empty state when entitlements is null", () => {
    mockUseAppContext.mockReturnValue(makeContext({ entitlements: null }));
    render(<LauncherScreen />);
    expect(screen.getByText("Brak dostępnych modułów")).toBeTruthy();
    expect(screen.queryByText("Organizacja")).toBeNull();
  });

  // ── 3. Empty state when permission missing ────────────────────────────────
  it("renders empty state when module permission is missing", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ permissions: { allow: ["members.read"], deny: [] } })
    );
    render(<LauncherScreen />);
    expect(screen.getByText("Brak dostępnych modułów")).toBeTruthy();
    expect(screen.queryByText("Organizacja")).toBeNull();
  });

  // ── 4. Tile press navigates to organization route ─────────────────────────
  it("calls router.push with /(app)/organization when tile is pressed", () => {
    render(<LauncherScreen />);
    const tile = screen.getByRole("button", { name: "Organizacja" });
    fireEvent.click(tile);
    expect(mockRouterPush).toHaveBeenCalledWith("/(app)/organization");
  });

  // ── 5. Org name in header ─────────────────────────────────────────────────
  it("renders org name in header", () => {
    render(<LauncherScreen />);
    expect(screen.getByText("Acme Corp")).toBeTruthy();
  });
});
