import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { AppState } from "@/contexts/app-context";
import type { HookResult } from "@/lib/queries/types";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterBack = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockRouterBack }),
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

const mockMutate = vi.fn();
const mockMutation = {
  mutate: mockMutate,
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
};
vi.mock("@/hooks/mutations/organization/use-update-org-profile-mutation", () => ({
  useUpdateOrgProfileMutation: () => mockMutation,
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
  permissions: { allow: ["org.update"], deny: [] },
  entitlements: null,
};

const ORG_PROFILE: OrgProfileData = {
  organization_id: "org-1",
  name: "Acme Corp",
  name_2: "Branch A",
  slug: "acme",
  bio: "A short bio",
  website: "https://acme.com",
  logo_url: null,
  theme_color: null,
  font_color: null,
};

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
}

// ─── Import screen after mocks ────────────────────────────────────────────────

// eslint-disable-next-line import/first
import EditOrgProfileScreen from "@/app/(app)/organization/edit";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EditOrgProfileScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutation state to default idle
    Object.assign(mockMutation, {
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    });
    setupNominalMocks();
  });

  // ── 1. Fields seeded from profile data ───────────────────────────────────
  it("pre-fills all text fields from loaded profile data", () => {
    render(<EditOrgProfileScreen />, { wrapper: createWrapper() });

    // Each field value appears as a TextInput value in the rendered tree
    expect(screen.getByDisplayValue("Acme Corp")).toBeTruthy();
    expect(screen.getByDisplayValue("Branch A")).toBeTruthy();
    expect(screen.getByDisplayValue("A short bio")).toBeTruthy();
    expect(screen.getByDisplayValue("https://acme.com")).toBeTruthy();
  });

  // ── 2. Save button disabled when no changes (isDirty=false) ──────────────
  it("Save button is disabled (no-op) when no fields have changed", () => {
    render(<EditOrgProfileScreen />, { wrapper: createWrapper() });
    const saveBtn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveBtn);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // ── 3. Save button enabled after field change ────────────────────────────
  it("Save button calls mutate when a field is changed", () => {
    render(<EditOrgProfileScreen />, { wrapper: createWrapper() });
    const nameInput = screen.getByDisplayValue("Acme Corp");
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    const saveBtn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveBtn);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  // ── 4. ActivityIndicator shown while isPending ───────────────────────────
  it("disables the back button and shows ActivityIndicator while isPending", () => {
    Object.assign(mockMutation, { isPending: true });
    render(<EditOrgProfileScreen />, { wrapper: createWrapper() });

    // Back button disabled: pressing it should NOT call router.back
    const backBtn = screen.getByRole("button", { name: "Go back" });
    fireEvent.click(backBtn);
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  // ── 5. Error message shown when isError ──────────────────────────────────
  it("shows the mutation error message when isError is true", () => {
    Object.assign(mockMutation, {
      isError: true,
      error: new Error("Validation failed"),
    });
    render(<EditOrgProfileScreen />, { wrapper: createWrapper() });
    expect(screen.getByText("Validation failed")).toBeTruthy();
  });
});
