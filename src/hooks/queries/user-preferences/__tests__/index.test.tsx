/**
 * User Preferences React Query Hooks Tests
 *
 * Tests for all user preferences query and mutation hooks.
 * Follows TDD pattern with comprehensive coverage.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import {
  usePreferencesQuery,
  useDashboardSettingsQuery,
  useUpdateProfileMutation,
  useUpdateRegionalSettingsMutation,
  useUpdateNotificationSettingsMutation,
  useUpdateDashboardSettingsMutation,
  useUpdateModuleSettingsMutation,
  useSyncUiSettingsMutation,
  useSetDefaultOrganizationMutation,
  useSetDefaultBranchMutation,
  userPreferencesKeys,
} from "../index";
import type { UserPreferences, DashboardSettings } from "@/lib/types/user-preferences";

// Mock server actions
vi.mock("@/app/actions/user-preferences", () => ({
  getUserPreferencesAction: vi.fn(),
  getDashboardSettingsAction: vi.fn(),
  updateProfileAction: vi.fn(),
  updateRegionalSettingsAction: vi.fn(),
  updateNotificationSettingsAction: vi.fn(),
  updateDashboardSettingsAction: vi.fn(),
  updateModuleSettingsAction: vi.fn(),
  syncUiSettingsAction: vi.fn(),
  setDefaultOrganizationAction: vi.fn(),
  setDefaultBranchAction: vi.fn(),
}));

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules
import {
  getUserPreferencesAction,
  getDashboardSettingsAction,
  updateProfileAction,
  updateRegionalSettingsAction,
  updateNotificationSettingsAction,
  updateDashboardSettingsAction,
  updateModuleSettingsAction,
  syncUiSettingsAction,
  setDefaultOrganizationAction,
  setDefaultBranchAction,
} from "@/app/actions/user-preferences";
import { toast } from "react-toastify";

// Test data
const mockPreferences: UserPreferences = {
  id: "pref-123",
  userId: "user-123",
  displayName: "Test User",
  phone: "+1234567890",
  timezone: "Europe/Warsaw",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "24h",
  locale: "pl",
  organizationId: "org-123",
  defaultBranchId: "branch-123",
  notificationSettings: {
    email: { enabled: true },
    push: { enabled: false },
  },
  dashboardSettings: {
    ui: { theme: "dark", sidebarCollapsed: false },
  },
  moduleSettings: {},
  updatedAt: "2026-02-01T12:00:00Z",
  updatedBy: "user-123",
};

const mockDashboardSettings: DashboardSettings = {
  ui: { theme: "dark", sidebarCollapsed: false },
  updated_at: "2026-02-01T12:00:00Z",
};

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("userPreferencesKeys", () => {
  it("generates correct query keys", () => {
    expect(userPreferencesKeys.all).toEqual(["user-preferences"]);
    expect(userPreferencesKeys.preferences()).toEqual(["user-preferences", "full"]);
    expect(userPreferencesKeys.dashboardSettings()).toEqual(["user-preferences", "dashboard"]);
  });
});

describe("usePreferencesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches preferences successfully", async () => {
    vi.mocked(getUserPreferencesAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => usePreferencesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockPreferences);
    expect(getUserPreferencesAction).toHaveBeenCalledTimes(1);
  });

  it("handles error response", async () => {
    vi.mocked(getUserPreferencesAction).mockResolvedValue({
      success: false,
      error: "Failed to fetch preferences",
    });

    const { result } = renderHook(() => usePreferencesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Failed to fetch preferences");
  });

  it("respects enabled parameter", async () => {
    vi.mocked(getUserPreferencesAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => usePreferencesQuery(false), {
      wrapper: createWrapper(),
    });

    // Should not fetch when disabled
    expect(result.current.isFetching).toBe(false);
    expect(getUserPreferencesAction).not.toHaveBeenCalled();
  });

  it("uses correct staleTime (5 minutes)", async () => {
    vi.mocked(getUserPreferencesAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => usePreferencesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should not be stale immediately
    expect(result.current.isStale).toBe(false);
  });
});

describe("useDashboardSettingsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches dashboard settings successfully", async () => {
    vi.mocked(getDashboardSettingsAction).mockResolvedValue({
      success: true,
      data: mockDashboardSettings,
    });

    const { result } = renderHook(() => useDashboardSettingsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockDashboardSettings);
    expect(getDashboardSettingsAction).toHaveBeenCalledTimes(1);
  });

  it("handles error response", async () => {
    vi.mocked(getDashboardSettingsAction).mockResolvedValue({
      success: false,
      error: "Failed to fetch dashboard settings",
    });

    const { result } = renderHook(() => useDashboardSettingsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Failed to fetch dashboard settings");
  });

  it("respects enabled parameter", async () => {
    const { result } = renderHook(() => useDashboardSettingsQuery(false), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getDashboardSettingsAction).not.toHaveBeenCalled();
  });
});

describe("useUpdateProfileMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates profile and shows success toast", async () => {
    vi.mocked(updateProfileAction).mockResolvedValue({
      success: true,
      data: { ...mockPreferences, displayName: "Updated Name" },
    });

    const { result } = renderHook(() => useUpdateProfileMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ displayName: "Updated Name" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateProfileAction).toHaveBeenCalledWith({ displayName: "Updated Name" });
    expect(toast.success).toHaveBeenCalledWith("Profile updated successfully");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(updateProfileAction).mockResolvedValue({
      success: false,
      error: "Invalid input",
    });

    const { result } = renderHook(() => useUpdateProfileMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ displayName: "Test" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Invalid input");
  });
});

describe("useUpdateRegionalSettingsMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates regional settings and shows success toast", async () => {
    vi.mocked(updateRegionalSettingsAction).mockResolvedValue({
      success: true,
      data: { ...mockPreferences, timezone: "America/New_York" },
    });

    const { result } = renderHook(() => useUpdateRegionalSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ timezone: "America/New_York" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateRegionalSettingsAction).toHaveBeenCalledWith({ timezone: "America/New_York" });
    expect(toast.success).toHaveBeenCalledWith("Regional settings updated");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(updateRegionalSettingsAction).mockResolvedValue({
      success: false,
      error: "Invalid timezone",
    });

    const { result } = renderHook(() => useUpdateRegionalSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ timezone: "Invalid/Zone" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Invalid timezone");
  });
});

describe("useUpdateNotificationSettingsMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates notification settings and shows success toast", async () => {
    vi.mocked(updateNotificationSettingsAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => useUpdateNotificationSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ email: { enabled: false } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateNotificationSettingsAction).toHaveBeenCalledWith({ email: { enabled: false } });
    expect(toast.success).toHaveBeenCalledWith("Notification settings updated");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(updateNotificationSettingsAction).mockResolvedValue({
      success: false,
      error: "Failed to update",
    });

    const { result } = renderHook(() => useUpdateNotificationSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ push: { enabled: true } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Failed to update");
  });
});

describe("useUpdateDashboardSettingsMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates dashboard settings without success toast", async () => {
    vi.mocked(updateDashboardSettingsAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => useUpdateDashboardSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ ui: { theme: "light", sidebarCollapsed: false } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateDashboardSettingsAction).toHaveBeenCalledWith({
      ui: { theme: "light", sidebarCollapsed: false },
    });
    // No success toast for dashboard settings (silent update)
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows error toast on failure", async () => {
    vi.mocked(updateDashboardSettingsAction).mockResolvedValue({
      success: false,
      error: "Update failed",
    });

    const { result } = renderHook(() => useUpdateDashboardSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ ui: { theme: "dark", sidebarCollapsed: true } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Update failed");
  });
});

describe("useUpdateModuleSettingsMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates module settings successfully", async () => {
    vi.mocked(updateModuleSettingsAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => useUpdateModuleSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        moduleId: "warehouse",
        settings: { pageSize: 50 },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateModuleSettingsAction).toHaveBeenCalledWith("warehouse", { pageSize: 50 });
  });

  it("shows error toast on failure", async () => {
    vi.mocked(updateModuleSettingsAction).mockResolvedValue({
      success: false,
      error: "Module not found",
    });

    const { result } = renderHook(() => useUpdateModuleSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        moduleId: "invalid",
        settings: {},
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Module not found");
  });
});

describe("useSyncUiSettingsMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs UI settings silently (no toast)", async () => {
    vi.mocked(syncUiSettingsAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => useSyncUiSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        theme: "dark",
        sidebarCollapsed: true,
        clientUpdatedAt: "2026-02-01T12:00:00Z",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(syncUiSettingsAction).toHaveBeenCalledWith({
      theme: "dark",
      sidebarCollapsed: true,
      clientUpdatedAt: "2026-02-01T12:00:00Z",
    });
    // Silent mutation - no toast
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("logs error but does not show toast on failure", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(syncUiSettingsAction).mockResolvedValue({
      success: false,
      error: "Sync failed",
    });

    const { result } = renderHook(() => useSyncUiSettingsMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        theme: "light",
        clientUpdatedAt: "2026-02-01T12:00:00Z",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Should log warning but not show toast
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[useSyncUiSettingsMutation] Sync failed:",
      "Sync failed"
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useSetDefaultOrganizationMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.reload
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  it("sets default organization and shows success toast", async () => {
    vi.mocked(setDefaultOrganizationAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => useSetDefaultOrganizationMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate("new-org-123");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setDefaultOrganizationAction).toHaveBeenCalledWith("new-org-123");
    expect(toast.success).toHaveBeenCalledWith("Default organization updated");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(setDefaultOrganizationAction).mockResolvedValue({
      success: false,
      error: "You are not a member of this organization",
    });

    const { result } = renderHook(() => useSetDefaultOrganizationMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate("invalid-org");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("You are not a member of this organization");
  });
});

describe("useSetDefaultBranchMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets default branch and shows success toast", async () => {
    vi.mocked(setDefaultBranchAction).mockResolvedValue({
      success: true,
      data: mockPreferences,
    });

    const { result } = renderHook(() => useSetDefaultBranchMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate("new-branch-123");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setDefaultBranchAction).toHaveBeenCalledWith("new-branch-123");
    expect(toast.success).toHaveBeenCalledWith("Default branch updated");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(setDefaultBranchAction).mockResolvedValue({
      success: false,
      error: "Branch not found",
    });

    const { result } = renderHook(() => useSetDefaultBranchMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate("invalid-branch");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Branch not found");
  });
});
