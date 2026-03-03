/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// getBranchPermissions uses PermissionService (branch-aware), not PermissionServiceV2.
// PermissionServiceV2 ignores branchId and only returns org-compiled permissions.
vi.mock("@/server/services/permission.service", () => ({
  PermissionService: {
    getPermissionSnapshotForUser: vi.fn(),
  },
}));

vi.mock("@/server/services/permission-v2.service", () => ({
  PermissionServiceV2: {
    getEffectivePermissionsArray: vi.fn(),
    currentUserHasPermission: vi.fn(),
    currentUserIsOrgMember: vi.fn(),
  },
}));

import {
  getBranchPermissions,
  getEffectivePermissions,
  checkPermission,
  checkOrgMembership,
} from "../permissions";
import { createClient } from "@/utils/supabase/server";
import { PermissionService } from "@/server/services/permission.service";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";

describe("getBranchPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return permissions with valid session", async () => {
    // Mock session
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockSnapshot = {
      allow: ["org.read", "org.update", "branches.read"],
      deny: [],
    };
    (PermissionService.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual(mockSnapshot);
    expect(PermissionService.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "user-123",
      "org-123",
      "branch-456"
    );
  });

  it("should return empty snapshot when no session", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
    expect(PermissionService.getPermissionSnapshotForUser).not.toHaveBeenCalled();
  });

  it("should handle null branchId (org-level permissions)", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockSnapshot = { allow: ["org.read", "members.read"], deny: [] };
    (PermissionService.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", null);

    expect(result.permissions).toEqual(mockSnapshot);
    expect(PermissionService.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "user-123",
      "org-123",
      null
    );
  });

  it("should return empty snapshot on PermissionService error", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (PermissionService.getPermissionSnapshotForUser as any).mockRejectedValue(
      new Error("Database connection failed")
    );

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
  });

  it("should return empty snapshot on auth error", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockRejectedValue(new Error("Auth service unavailable")),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
  });

  it("should return empty snapshot when createClient fails", async () => {
    (createClient as any).mockRejectedValue(new Error("Supabase initialization failed"));

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
  });

  it("should pass correct parameters to PermissionService", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "specific-user-id" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionService.getPermissionSnapshotForUser as any).mockResolvedValue({
      allow: [],
      deny: [],
    });

    await getBranchPermissions("specific-org-id", "specific-branch-id");

    expect(PermissionService.getPermissionSnapshotForUser).toHaveBeenCalledTimes(1);
    expect(PermissionService.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "specific-user-id",
      "specific-org-id",
      "specific-branch-id"
    );
  });

  it("should return branch-aware permissions (includes branch-scoped role permissions)", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // PermissionService returns both org and branch-scoped permissions expanded
    const mockSnapshot = {
      allow: [
        "org.read",
        "org.update",
        "branches.read",
        "branches.create",
        "branches.update",
        "branches.delete",
        "members.read",
        "members.manage",
      ],
      deny: [],
    };
    (PermissionService.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions.allow).toContain("org.read");
    expect(result.permissions.allow).toContain("branches.read");
    expect(result.permissions.deny).toEqual([]);
  });
});

describe("getEffectivePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return permission array with valid session", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockPermissions = ["org.read", "branches.read", "members.read"];
    (PermissionServiceV2.getEffectivePermissionsArray as any).mockResolvedValue(mockPermissions);

    const result = await getEffectivePermissions("org-123");

    expect(result).toEqual(mockPermissions);
  });

  it("should return empty array when no session", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getEffectivePermissions("org-123");

    expect(result).toEqual([]);
  });
});

describe("checkPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when user has permission", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserHasPermission as any).mockResolvedValue(true);

    const result = await checkPermission("org-123", "org.read");

    expect(result).toBe(true);
    expect(PermissionServiceV2.currentUserHasPermission).toHaveBeenCalledWith(
      mockSupabase,
      "org-123",
      "org.read"
    );
  });

  it("should return false when user lacks permission", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserHasPermission as any).mockResolvedValue(false);

    const result = await checkPermission("org-123", "members.manage");

    expect(result).toBe(false);
  });

  it("should return false on error", async () => {
    (createClient as any).mockRejectedValue(new Error("Failed"));

    const result = await checkPermission("org-123", "org.read");

    expect(result).toBe(false);
  });
});

describe("checkOrgMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when user is member", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserIsOrgMember as any).mockResolvedValue(true);

    const result = await checkOrgMembership("org-123");

    expect(result).toBe(true);
  });

  it("should return false when user is not member", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserIsOrgMember as any).mockResolvedValue(false);

    const result = await checkOrgMembership("org-123");

    expect(result).toBe(false);
  });

  it("should return false on error", async () => {
    (createClient as any).mockRejectedValue(new Error("Failed"));

    const result = await checkOrgMembership("org-123");

    expect(result).toBe(false);
  });
});
