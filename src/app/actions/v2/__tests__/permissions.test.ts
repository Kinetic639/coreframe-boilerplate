/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/server/services/permission.service", () => ({
  PermissionService: {
    getPermissionSnapshotForUser: vi.fn(),
  },
}));

import { getBranchPermissions } from "../permissions";
import { createClient } from "@/utils/supabase/server";
import { PermissionService } from "@/server/services/permission.service";

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

    // Mock permission service
    const mockSnapshot = {
      allow: ["warehouse.products.read", "warehouse.products.create"],
      deny: ["warehouse.products.delete"],
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

    const mockSnapshot = { allow: ["org.settings.read", "org.members.manage"], deny: [] };
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

    // Mock service throwing error
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

  it("should handle wildcard permissions in response", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockSnapshot = {
      allow: ["warehouse.*", "teams.members.read"],
      deny: ["warehouse.products.delete"],
    };
    (PermissionService.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions.allow).toContain("warehouse.*");
    expect(result.permissions.deny).toContain("warehouse.products.delete");
  });
});
