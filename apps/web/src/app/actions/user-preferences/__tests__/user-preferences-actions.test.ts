/**
 * @vitest-environment node
 *
 * Tests: app/actions/user-preferences/index.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const { mockGetUser, mockFrom, mockStorage, mockGetPermissionSnapshot, mockLoadAppContextV2 } =
  vi.hoisted(() => {
    const mockGetUser = vi.fn();
    const mockFrom = vi.fn();
    const mockStorage = {
      from: vi.fn(),
    };
    const mockGetPermissionSnapshot = vi.fn();
    const mockLoadAppContextV2 = vi.fn();
    return { mockGetUser, mockFrom, mockStorage, mockGetPermissionSnapshot, mockLoadAppContextV2 };
  });

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: mockStorage,
  }),
}));

vi.mock("@/server/services/user-preferences.service", () => ({
  UserPreferencesService: {
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

vi.mock("@/server/loaders/v2/load-app-context.v2", () => ({
  loadAppContextV2: mockLoadAppContextV2,
}));

vi.mock("@/server/services/permission-v2.service", () => ({
  PermissionServiceV2: {
    getPermissionSnapshotForUser: mockGetPermissionSnapshot,
  },
}));

vi.mock("crypto", () => ({ randomUUID: vi.fn().mockReturnValue("uuid-1234") }));

import { createClient } from "@/utils/supabase/server";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
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
  uploadAvatarAction,
  removeAvatarAction,
  getAvatarSignedUrlAction,
} from "../index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_PREFS = {
  id: "pref-1",
  user_id: "user-1",
  language: "en",
  timezone: "UTC",
};

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";

function resetAuth(userId = "user-1") {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockLoadAppContextV2.mockResolvedValue({ activeOrgId: "org-1", activeBranchId: "branch-1" });
  mockGetPermissionSnapshot.mockResolvedValue({ allow: ["account.*"], deny: [] });
  vi.mocked(UserPreferencesService.getOrCreatePreferences).mockResolvedValue(MOCK_PREFS as never);
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: mockStorage,
  } as never);
}

// ─── getUserPreferencesAction ─────────────────────────────────────────────────

describe("getUserPreferencesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("returns preferences when authorized", async () => {
    vi.mocked(UserPreferencesService.getOrCreatePreferences).mockResolvedValue(MOCK_PREFS as never);
    const result = await getUserPreferencesAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: unknown }).data).toEqual(MOCK_PREFS);
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT expired" } });
    const result = await getUserPreferencesAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Not authenticated");
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await getUserPreferencesAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Permission denied");
  });

  it("handles service error", async () => {
    vi.mocked(UserPreferencesService.getOrCreatePreferences).mockRejectedValue(
      new Error("DB error")
    );
    const result = await getUserPreferencesAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("DB error");
  });
});

// ─── getDashboardSettingsAction ───────────────────────────────────────────────

describe("getDashboardSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("returns dashboard settings when authorized", async () => {
    const settings = { theme: "dark", layout: "grid" };
    vi.mocked(UserPreferencesService.getDashboardSettings).mockResolvedValue(settings as never);
    const result = await getDashboardSettingsAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: unknown }).data).toEqual(settings);
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await getDashboardSettingsAction();
    expect(result.success).toBe(false);
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await getDashboardSettingsAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Permission denied");
  });
});

// ─── updateProfileAction ──────────────────────────────────────────────────────

describe("updateProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("updates profile with valid input", async () => {
    vi.mocked(UserPreferencesService.updateProfile).mockResolvedValue(MOCK_PREFS as never);
    const result = await updateProfileAction({ firstName: "Jane", lastName: "Doe" });
    expect(result.success).toBe(true);
  });

  it("returns validation error for invalid input", async () => {
    // firstName too long (over 100 chars)
    const result = await updateProfileAction({ firstName: "x".repeat(200) });
    expect(result.success).toBe(false);
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await updateProfileAction({ firstName: "Jane" });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Permission denied");
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await updateProfileAction({ firstName: "Jane" });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Not authenticated");
  });
});

// ─── updateRegionalSettingsAction ────────────────────────────────────────────

describe("updateRegionalSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("updates regional settings with valid input", async () => {
    vi.mocked(UserPreferencesService.updateRegionalSettings).mockResolvedValue(MOCK_PREFS as never);
    const result = await updateRegionalSettingsAction({ timezone: "Europe/Warsaw", locale: "pl" });
    expect(result.success).toBe(true);
  });

  it("returns validation error for invalid timeFormat", async () => {
    const result = await updateRegionalSettingsAction({ timeFormat: "invalid" });
    expect(result.success).toBe(false);
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await updateRegionalSettingsAction({ timezone: "UTC" });
    expect(result.success).toBe(false);
  });
});

// ─── updateNotificationSettingsAction ────────────────────────────────────────

describe("updateNotificationSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("updates notification settings with valid input", async () => {
    vi.mocked(UserPreferencesService.updateNotificationSettings).mockResolvedValue(
      MOCK_PREFS as never
    );
    const result = await updateNotificationSettingsAction({ email_notifications: true });
    expect(result.success).toBe(true);
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await updateNotificationSettingsAction({ email_notifications: false });
    expect(result.success).toBe(false);
  });
});

// ─── updateDashboardSettingsAction ───────────────────────────────────────────

describe("updateDashboardSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("updates dashboard settings with valid input", async () => {
    vi.mocked(UserPreferencesService.updateDashboardSettings).mockResolvedValue(
      MOCK_PREFS as never
    );
    const result = await updateDashboardSettingsAction({ theme: "light" });
    expect(result.success).toBe(true);
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await updateDashboardSettingsAction({ theme: "dark" });
    expect(result.success).toBe(false);
  });
});

// ─── updateModuleSettingsAction ───────────────────────────────────────────────

describe("updateModuleSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("updates module settings with valid input", async () => {
    vi.mocked(UserPreferencesService.updateModuleSettings).mockResolvedValue(MOCK_PREFS as never);
    const result = await updateModuleSettingsAction("warehouse", { view: "grid" });
    expect(result.success).toBe(true);
  });

  it("returns validation error for missing moduleId", async () => {
    const result = await updateModuleSettingsAction(null, { x: 1 });
    expect(result.success).toBe(false);
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await updateModuleSettingsAction("warehouse", {});
    expect(result.success).toBe(false);
  });
});

// ─── syncUiSettingsAction ─────────────────────────────────────────────────────

describe("syncUiSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("syncs UI settings with valid input", async () => {
    vi.mocked(UserPreferencesService.syncUiSettings).mockResolvedValue(MOCK_PREFS as never);
    const result = await syncUiSettingsAction({
      sidebarCollapsed: true,
      clientUpdatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("returns validation error for strict schema rejection (unknown keys)", async () => {
    const result = await syncUiSettingsAction({ unknownKey: true });
    expect(result.success).toBe(false);
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await syncUiSettingsAction({
      sidebarCollapsed: false,
      clientUpdatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

// ─── setDefaultOrganizationAction ────────────────────────────────────────────

describe("setDefaultOrganizationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("sets default org with valid UUID", async () => {
    vi.mocked(UserPreferencesService.setDefaultOrganization).mockResolvedValue(MOCK_PREFS as never);
    const result = await setDefaultOrganizationAction(VALID_UUID);
    expect(result.success).toBe(true);
  });

  it("returns validation error for non-UUID orgId", async () => {
    const result = await setDefaultOrganizationAction("not-a-uuid");
    expect(result.success).toBe(false);
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await setDefaultOrganizationAction(VALID_UUID);
    expect(result.success).toBe(false);
  });
});

// ─── setDefaultBranchAction ───────────────────────────────────────────────────

describe("setDefaultBranchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("sets default branch with valid UUID", async () => {
    vi.mocked(UserPreferencesService.setDefaultBranch).mockResolvedValue(MOCK_PREFS as never);
    const result = await setDefaultBranchAction(VALID_UUID_2);
    expect(result.success).toBe(true);
  });

  it("returns validation error for non-UUID branchId", async () => {
    const result = await setDefaultBranchAction("not-a-uuid");
    expect(result.success).toBe(false);
  });
});

// ─── uploadAvatarAction ───────────────────────────────────────────────────────

describe("uploadAvatarAction", () => {
  const makeFile = (type = "image/png", size = 100) => {
    const buf = new Uint8Array(size);
    const file = new File([buf], "avatar.png", { type });
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { avatar_path: null }, error: null }),
    });
    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://cdn.example.com/avatar.jpg" } }),
    });
  });

  it("returns error when no file provided", async () => {
    const formData = new FormData();
    const result = await uploadAvatarAction(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("No file provided");
  });

  it("returns error for non-image file type", async () => {
    const formData = new FormData();
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    formData.append("file", file);
    const result = await uploadAvatarAction(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("Invalid file type");
  });

  it("returns error when file too large", async () => {
    const formData = new FormData();
    const bigBuf = new Uint8Array(6 * 1024 * 1024);
    const file = new File([bigBuf], "big.jpg", { type: "image/jpeg" });
    formData.append("file", file);
    const result = await uploadAvatarAction(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("too large");
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const formData = new FormData();
    formData.append("file", makeFile());
    const result = await uploadAvatarAction(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Permission denied");
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const formData = new FormData();
    formData.append("file", makeFile());
    const result = await uploadAvatarAction(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Not authenticated");
  });

  it("uploads successfully and returns avatar path", async () => {
    const fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { avatar_path: null }, error: null }),
    };
    // make update().eq() resolve
    fromChain.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockFrom.mockReturnValue(fromChain);

    const formData = new FormData();
    formData.append("file", makeFile());
    const result = await uploadAvatarAction(formData);
    expect(result.success).toBe(true);
    expect((result as { success: true; data: { avatarPath: string } }).data.avatarPath).toContain(
      "uuid-1234"
    );
  });

  it("rolls back storage on DB error", async () => {
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: removeMock,
    });
    const fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { avatar_path: null }, error: null }),
      update: vi
        .fn()
        .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "write error" } }) }),
    };
    mockFrom.mockReturnValue(fromChain);

    const formData = new FormData();
    formData.append("file", makeFile());
    const result = await uploadAvatarAction(formData);
    expect(result.success).toBe(false);
    expect(removeMock).toHaveBeenCalled();
  });
});

// ─── removeAvatarAction ───────────────────────────────────────────────────────

describe("removeAvatarAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
    mockStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("removes avatar successfully", async () => {
    const fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { avatar_path: "path/to/avatar.jpg" }, error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    };
    mockFrom.mockReturnValue(fromChain);

    const result = await removeAvatarAction();
    expect(result.success).toBe(true);
  });

  it("returns error when permission denied", async () => {
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
    const result = await removeAvatarAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Permission denied");
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await removeAvatarAction();
    expect(result.success).toBe(false);
  });

  it("returns error when DB update fails", async () => {
    const fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { avatar_path: "old.jpg" }, error: null }),
      update: vi
        .fn()
        .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "write error" } }) }),
    };
    mockFrom.mockReturnValue(fromChain);
    const result = await removeAvatarAction();
    expect(result.success).toBe(false);
  });

  it("succeeds even when no avatar_path is set", async () => {
    const fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { avatar_path: null }, error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    };
    mockFrom.mockReturnValue(fromChain);
    const result = await removeAvatarAction();
    expect(result.success).toBe(true);
  });
});

// ─── getAvatarSignedUrlAction ─────────────────────────────────────────────────

describe("getAvatarSignedUrlAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuth();
  });

  it("returns null signedUrl when no avatar_path", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { avatar_path: null }, error: null }),
    });
    const result = await getAvatarSignedUrlAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: { signedUrl: null } }).data.signedUrl).toBeNull();
  });

  it("returns signed URL when avatar_path is set", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { avatar_path: "user-1/uuid-1234.jpg" },
        error: null,
      }),
    });
    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://cdn.example.com/avatar.jpg" },
        error: null,
      }),
    });
    const result = await getAvatarSignedUrlAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: { signedUrl: string } }).data.signedUrl).toBe(
      "https://cdn.example.com/avatar.jpg"
    );
  });

  it("returns null signedUrl when storage fails", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { avatar_path: "user-1/uuid-1234.jpg" },
        error: null,
      }),
    });
    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: "failed" } }),
    });
    const result = await getAvatarSignedUrlAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: { signedUrl: null } }).data.signedUrl).toBeNull();
  });

  it("returns error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await getAvatarSignedUrlAction();
    expect(result.success).toBe(false);
  });
});
