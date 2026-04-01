/**
 * @vitest-environment node
 *
 * Covers gap paths in profile.ts:
 *   - uploadOrgLogoAction (completely untested before this file)
 *   - removeOrgLogoAction (completely untested before this file)
 *
 * getOrgProfileAction and updateOrgProfileAction are already covered in
 * actions.test.ts and actions-org-gaps.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const {
  mockCreateClient,
  mockLoadDashboardContextV2,
  mockRequireModuleAccess,
  mockMapEntitlementError,
  mockEventEmit,
  mockUploadLogo,
  mockUpdateProfile,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockLoadDashboardContextV2: vi.fn(),
  mockRequireModuleAccess: vi.fn().mockResolvedValue(undefined),
  mockMapEntitlementError: vi.fn().mockReturnValue(null),
  mockEventEmit: vi.fn().mockResolvedValue({ success: true }),
  mockUploadLogo: vi.fn(),
  mockUpdateProfile: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: mockLoadDashboardContextV2,
}));
vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: mockRequireModuleAccess },
  mapEntitlementError: mockMapEntitlementError,
}));
vi.mock("@/server/services/organization.service", () => ({
  OrgProfileService: {
    getProfile: vi.fn(),
    updateProfile: mockUpdateProfile,
    uploadLogo: mockUploadLogo,
  },
}));
vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: mockEventEmit },
}));

import { uploadOrgLogoAction, removeOrgLogoAction } from "../profile";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ORG_ID = "org-123";
const USER_ID = "user-abc";

const CTX_WITH_PERM = {
  app: { activeOrgId: ORG_ID },
  user: {
    user: { id: USER_ID },
    permissionSnapshot: {
      allow: ["module.organization-management.access", "org.*"],
      deny: [],
    },
  },
};

const CTX_NO_ORG = {
  app: { activeOrgId: null },
  user: {
    user: { id: USER_ID },
    permissionSnapshot: { allow: [], deny: [] },
  },
};

const CTX_NO_MODULE = {
  app: { activeOrgId: ORG_ID },
  user: {
    user: { id: USER_ID },
    permissionSnapshot: { allow: [], deny: [] },
  },
};

const CTX_NO_UPDATE = {
  app: { activeOrgId: ORG_ID },
  user: {
    user: { id: USER_ID },
    permissionSnapshot: {
      allow: ["module.organization-management.access"],
      deny: [],
    },
  },
};

function makeStorageMock(files: { name: string }[] = []) {
  const bucketMock = {
    list: vi.fn().mockResolvedValue({ data: files, error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(bucketMock),
    _bucket: bucketMock,
  };
}

function makeSupabaseMock(storageMock?: ReturnType<typeof makeStorageMock>) {
  const storage = storageMock ?? makeStorageMock();
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    storage,
  };
}

function makeFile(name = "logo.png", type = "image/png", sizeMb = 1): File {
  const content = new Uint8Array(sizeMb * 1024 * 1024);
  return new File([content], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireModuleAccess.mockResolvedValue(undefined);
  mockMapEntitlementError.mockReturnValue(null);
  mockEventEmit.mockResolvedValue({ success: true });
  mockLoadDashboardContextV2.mockResolvedValue(CTX_WITH_PERM);
  mockCreateClient.mockResolvedValue(makeSupabaseMock());
});

// ─── uploadOrgLogoAction ──────────────────────────────────────────────────────

describe("uploadOrgLogoAction", () => {
  it("returns error when no active org", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(CTX_NO_ORG);

    const fd = new FormData();
    fd.append("file", makeFile());

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });

  it("returns unauthorized when module access missing", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(CTX_NO_MODULE);

    const fd = new FormData();
    fd.append("file", makeFile());

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns unauthorized when org.update permission missing", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(CTX_NO_UPDATE);

    const fd = new FormData();
    fd.append("file", makeFile());

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns error when no file in FormData", async () => {
    const fd = new FormData();

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No file provided");
  });

  it("returns error when file exceeds 5 MB", async () => {
    const fd = new FormData();
    fd.append("file", makeFile("big.png", "image/png", 6));

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("File must be under 5 MB");
  });

  it("returns error when file type is unsupported", async () => {
    const fd = new FormData();
    fd.append("file", makeFile("photo.bmp", "image/bmp", 0.5));

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unsupported file type");
  });

  it("accepts webp files", async () => {
    mockUploadLogo.mockResolvedValue({
      success: true,
      data: { logo_url: "https://cdn/logo.webp" },
    });
    const fd = new FormData();
    fd.append("file", makeFile("logo.webp", "image/webp", 1));

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(true);
  });

  it("calls OrgProfileService.uploadLogo with supabase, orgId, and file", async () => {
    mockUploadLogo.mockResolvedValue({
      success: true,
      data: { logo_url: "https://cdn/logo.png" },
    });
    const fd = new FormData();
    const file = makeFile();
    fd.append("file", file);

    await uploadOrgLogoAction(fd);

    expect(mockUploadLogo).toHaveBeenCalledWith(expect.anything(), ORG_ID, file);
  });

  it("emits org.updated event on successful upload", async () => {
    mockUploadLogo.mockResolvedValue({
      success: true,
      data: { logo_url: "https://cdn/logo.png" },
    });
    const fd = new FormData();
    fd.append("file", makeFile());

    await uploadOrgLogoAction(fd);

    expect(mockEventEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.updated",
        metadata: { updated_fields: ["logo_url"] },
      })
    );
  });

  it("returns success even when event emission fails", async () => {
    mockUploadLogo.mockResolvedValue({
      success: true,
      data: { logo_url: "https://cdn/logo.png" },
    });
    mockEventEmit.mockResolvedValue({ success: false, error: "emit failed" });

    const fd = new FormData();
    fd.append("file", makeFile());

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(true);
  });

  it("returns service error when uploadLogo fails", async () => {
    mockUploadLogo.mockResolvedValue({ success: false, error: "Storage quota exceeded" });

    const fd = new FormData();
    fd.append("file", makeFile());

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Storage quota exceeded");
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("returns Unexpected error when entitlements throws", async () => {
    mockRequireModuleAccess.mockRejectedValue(new Error("module not found"));
    mockMapEntitlementError.mockReturnValue(null);

    const fd = new FormData();
    fd.append("file", makeFile());

    const result = await uploadOrgLogoAction(fd);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unexpected error");
  });
});

// ─── removeOrgLogoAction ──────────────────────────────────────────────────────

describe("removeOrgLogoAction", () => {
  it("returns error when no active org", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(CTX_NO_ORG);
    const result = await removeOrgLogoAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });

  it("returns unauthorized when module access missing", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(CTX_NO_MODULE);
    const result = await removeOrgLogoAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns unauthorized when org.update permission missing", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(CTX_NO_UPDATE);
    const result = await removeOrgLogoAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("calls storage.remove when existing files are found", async () => {
    const storageMock = makeStorageMock([{ name: "logo-123.png" }]);
    mockCreateClient.mockResolvedValue(makeSupabaseMock(storageMock));
    mockUpdateProfile.mockResolvedValue({ success: true, data: undefined });

    await removeOrgLogoAction();

    expect(storageMock._bucket.list).toHaveBeenCalledWith(ORG_ID, { limit: 10 });
    expect(storageMock._bucket.remove).toHaveBeenCalledWith([`${ORG_ID}/logo-123.png`]);
  });

  it("does NOT call storage.remove when no files exist", async () => {
    const storageMock = makeStorageMock([]);
    mockCreateClient.mockResolvedValue(makeSupabaseMock(storageMock));
    mockUpdateProfile.mockResolvedValue({ success: true, data: undefined });

    await removeOrgLogoAction();

    expect(storageMock._bucket.remove).not.toHaveBeenCalled();
  });

  it("calls OrgProfileService.updateProfile with logo_url: null", async () => {
    mockUpdateProfile.mockResolvedValue({ success: true, data: undefined });

    await removeOrgLogoAction();

    expect(mockUpdateProfile).toHaveBeenCalledWith(expect.anything(), ORG_ID, { logo_url: null });
  });

  it("emits org.updated event on successful removal", async () => {
    mockUpdateProfile.mockResolvedValue({ success: true, data: undefined });

    await removeOrgLogoAction();

    expect(mockEventEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.updated",
        metadata: { updated_fields: ["logo_url"] },
      })
    );
  });

  it("returns success even when event emission fails", async () => {
    mockUpdateProfile.mockResolvedValue({ success: true, data: undefined });
    mockEventEmit.mockResolvedValue({ success: false, error: "emit error" });

    const result = await removeOrgLogoAction();
    expect(result.success).toBe(true);
  });

  it("returns service error when updateProfile fails", async () => {
    mockUpdateProfile.mockResolvedValue({ success: false, error: "DB update failed" });

    const result = await removeOrgLogoAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("DB update failed");
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("returns Unexpected error when entitlements throws", async () => {
    mockRequireModuleAccess.mockRejectedValue(new Error("module check failed"));
    mockMapEntitlementError.mockReturnValue(null);

    const result = await removeOrgLogoAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unexpected error");
  });
});
