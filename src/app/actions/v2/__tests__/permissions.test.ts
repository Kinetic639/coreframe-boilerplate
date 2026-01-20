/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/server/services/permission-v2.service", () => ({
  PermissionServiceV2: {
    getPermissionSnapshotForUser: vi.fn(),
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

    // Mock permission service - V2 returns explicit permissions, no wildcards at runtime
    const mockSnapshot = {
      allow: ["org.read", "org.update", "branches.read"],
      deny: [], // V2: deny is always empty (handled at compile time)
    };
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual(mockSnapshot);
    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
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
    expect(PermissionServiceV2.getPermissionSnapshotForUser).not.toHaveBeenCalled();
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
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", null);

    expect(result.permissions).toEqual(mockSnapshot);
    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "user-123",
      "org-123",
      null
    );
  });

  it("should return empty snapshot on PermissionServiceV2 error", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // Mock service throwing error
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockRejectedValue(
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

  it("should pass correct parameters to PermissionServiceV2", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "specific-user-id" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue({
      allow: [],
      deny: [],
    });

    await getBranchPermissions("specific-org-id", "specific-branch-id");

    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledTimes(1);
    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "specific-user-id",
      "specific-org-id",
      "specific-branch-id"
    );
  });

  it("should return V2 explicit permissions (no wildcards at runtime)", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // V2: Wildcards are expanded at compile time, so we get explicit permissions
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
      deny: [], // V2: deny is always empty
    };
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions.allow).toContain("org.read");
    expect(result.permissions.allow).toContain("branches.read");
    expect(result.permissions.deny).toEqual([]); // V2: deny is always empty
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
