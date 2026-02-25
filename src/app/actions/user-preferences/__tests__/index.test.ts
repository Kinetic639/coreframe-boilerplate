/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/server/services/user-preferences.service", () => ({
  UserPreferencesService: {
    getPreferences: vi.fn(),
    getOrCreatePreferences: vi.fn(),
    getDashboardSettings: vi.fn(),
    updateProfile: vi.fn(),
    updateRegionalSettings: vi.fn(),
    updateNotificationSettings: vi.fn(),
    updateDashboardSettings: vi.fn(),
    updateModuleSettings: vi.fn(),
    syncUiSettings: vi.fn(),
    setDefaultOrganization: vi.fn(),
    setDefaultBranch: vi.fn(),
  },
}));

// Default: permission allowed, orgId available
vi.mock("@/lib/api/load-app-context-server", () => ({
  loadAppContextServer: vi.fn().mockResolvedValue({ activeOrgId: "org-123" }),
}));

vi.mock("@/server/services/permission-v2.service", () => ({
  PermissionServiceV2: {
    currentUserHasPermission: vi.fn().mockResolvedValue(true),
  },
}));

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
} from "../index";
import { createClient } from "@/utils/supabase/server";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";

// Sample user preferences for testing
const samplePreferences = {
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
  notificationSettings: { email: { enabled: true } },
  dashboardSettings: { ui: { theme: "dark" } },
  moduleSettings: { warehouse: { pageSize: 25 } },
  updatedAt: "2026-02-01T12:00:00Z",
  updatedBy: "user-123",
};

describe("getUserPreferencesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return preferences when authenticated", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);

    const result = await getUserPreferencesAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe("user-123");
      expect(result.data.displayName).toBe("Test User");
    }
  });

  it("should return error when not authenticated", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getUserPreferencesAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });

  it("should return error on service failure", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockRejectedValue(
      new Error("Database error")
    );

    const result = await getUserPreferencesAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Database error");
    }
  });
});

describe("getDashboardSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return dashboard settings when authenticated", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getDashboardSettings as any).mockResolvedValue({
      ui: { theme: "dark" },
    });

    const result = await getDashboardSettingsAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ ui: { theme: "dark" } });
    }
  });

  it("should return null when user has no preferences", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getDashboardSettings as any).mockResolvedValue(null);

    const result = await getDashboardSettingsAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });
});

describe("updateProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update profile with valid input", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.updateProfile as any).mockResolvedValue({
      ...samplePreferences,
      displayName: "Updated Name",
    });

    const result = await updateProfileAction({ displayName: "Updated Name" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Updated Name");
    }
  });
});

describe("updateRegionalSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update regional settings with valid timezone", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.updateRegionalSettings as any).mockResolvedValue({
      ...samplePreferences,
      timezone: "America/New_York",
    });

    const result = await updateRegionalSettingsAction({ timezone: "America/New_York" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("America/New_York");
    }
  });
});

describe("updateNotificationSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update notification settings", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.updateNotificationSettings as any).mockResolvedValue({
      ...samplePreferences,
      notificationSettings: { email: { enabled: false } },
    });

    const result = await updateNotificationSettingsAction({ email: { enabled: false } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notificationSettings.email?.enabled).toBe(false);
    }
  });
});

describe("updateDashboardSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update dashboard settings", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.updateDashboardSettings as any).mockResolvedValue({
      ...samplePreferences,
      dashboardSettings: { ui: { theme: "light" } },
    });

    const result = await updateDashboardSettingsAction({ ui: { theme: "light" } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dashboardSettings.ui?.theme).toBe("light");
    }
  });
});

describe("updateModuleSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update module settings with valid input", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.updateModuleSettings as any).mockResolvedValue({
      ...samplePreferences,
      moduleSettings: { warehouse: { pageSize: 50 } },
    });

    const result = await updateModuleSettingsAction("warehouse", { pageSize: 50 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.moduleSettings.warehouse?.pageSize).toBe(50);
    }
  });

  it("should reject invalid module ID format", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await updateModuleSettingsAction("Invalid Module!", { pageSize: 50 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("lowercase alphanumeric");
    }
  });
});

describe("syncUiSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sync UI settings", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.syncUiSettings as any).mockResolvedValue({
      ...samplePreferences,
      dashboardSettings: { ui: { theme: "light", sidebarCollapsed: true } },
    });

    const result = await syncUiSettingsAction({
      theme: "light",
      sidebarCollapsed: true,
      updatedAt: "2026-02-01T14:00:00Z",
    });

    expect(result.success).toBe(true);
  });
});

describe("setDefaultOrganizationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set default organization with valid UUID", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.setDefaultOrganization as any).mockResolvedValue({
      ...samplePreferences,
      organizationId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const result = await setDefaultOrganizationAction("550e8400-e29b-41d4-a716-446655440000");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organizationId).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("should reject invalid organization ID", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await setDefaultOrganizationAction("not-a-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("valid UUID");
    }
  });
});

describe("setDefaultBranchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set default branch with valid UUID", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (UserPreferencesService.getOrCreatePreferences as any).mockResolvedValue(samplePreferences);
    (UserPreferencesService.setDefaultBranch as any).mockResolvedValue({
      ...samplePreferences,
      defaultBranchId: "550e8400-e29b-41d4-a716-446655440001",
    });

    const result = await setDefaultBranchAction("550e8400-e29b-41d4-a716-446655440001");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultBranchId).toBe("550e8400-e29b-41d4-a716-446655440001");
    }
  });

  it("should reject invalid branch ID", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await setDefaultBranchAction("not-a-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("valid UUID");
    }
  });
});

describe("Permission denial (fail-closed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updateProfileAction returns { success: false } when permission is denied", async () => {
    // Authenticated user
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // Permission service returns false (denied)
    (loadAppContextServer as any).mockResolvedValue({ activeOrgId: "org-123" });
    (PermissionServiceV2.currentUserHasPermission as any).mockResolvedValue(false);

    const result = await updateProfileAction({ displayName: "Test" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Permission denied");
    }
    // Service should NOT have been called
    expect(UserPreferencesService.updateProfile).not.toHaveBeenCalled();
  });

  it("getUserPreferencesAction returns { success: false } when ACCOUNT_PREFERENCES_READ is denied", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (loadAppContextServer as any).mockResolvedValue({ activeOrgId: "org-123" });
    (PermissionServiceV2.currentUserHasPermission as any).mockResolvedValue(false);

    const result = await getUserPreferencesAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Permission denied");
    }
    expect(UserPreferencesService.getOrCreatePreferences).not.toHaveBeenCalled();
  });

  it("updateProfileAction returns { success: false } when no active org context", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // No org context (null activeOrgId) — fail-closed
    (loadAppContextServer as any).mockResolvedValue({ activeOrgId: null });
    (PermissionServiceV2.currentUserHasPermission as any).mockResolvedValue(false);

    const result = await updateProfileAction({ displayName: "Test" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Permission denied");
    }
  });
});
