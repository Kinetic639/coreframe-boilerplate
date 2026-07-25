/**
 * @vitest-environment node
 *
 * AdminContextV2 loader tests — security-critical, verifies:
 * 1. Returns null when unauthenticated (no session)
 * 2. Synthesises correct permission snapshot from entitlements
 * 3. Profile fields loaded from users table with proper fallbacks
 * 4. Handles DB errors gracefully (fail-closed)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before module import
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();
const mockUsersQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};
const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: vi.fn(() => mockUsersQuery),
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

const mockLoadAdminEntitlements = vi.fn();
vi.mock("@/server/services/admin-entitlements.service", () => ({
  AdminEntitlementsService: {
    loadAdminEntitlements: (...args: any[]) => mockLoadAdminEntitlements(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------
import { loadAdminContextV2 } from "../load-admin-context.v2";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const mockAuthUser = {
  id: "user-123",
  email: "admin@example.com",
  user_metadata: {
    first_name: "Meta",
    last_name: "Data",
  },
};

const mockUserProfile = {
  first_name: "Admin",
  last_name: "User",
  avatar_url: "https://example.com/avatar.png",
  avatar_path: null,
};

const enabledEntitlements = {
  user_id: "user-123",
  enabled: true,
  updated_at: "2026-01-01T00:00:00Z",
};

const disabledEntitlements = {
  user_id: "user-123",
  enabled: false,
  updated_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("loadAdminContextV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset users query chain defaults
    mockUsersQuery.select.mockReturnThis();
    mockUsersQuery.eq.mockReturnThis();
    mockUsersQuery.maybeSingle.mockResolvedValue({ data: mockUserProfile, error: null });
  });

  // -------------------------------------------------------------------------
  // Authentication gate
  // -------------------------------------------------------------------------
  describe("authentication gate", () => {
    it("should return null when no session exists (unauthenticated)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const result = await loadAdminContextV2();

      expect(result).toBeNull();
    });

    it("should return null when auth.getUser returns an error", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "JWT expired", code: "401" },
      });

      const result = await loadAdminContextV2();

      expect(result).toBeNull();
    });

    it("should return null when user is undefined (edge case)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: undefined }, error: null });

      const result = await loadAdminContextV2();

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Permission snapshot synthesis — core security logic
  // -------------------------------------------------------------------------
  describe("permission snapshot synthesis", () => {
    it("should synthesise superadmin.* allow when entitlements.enabled is true", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockLoadAdminEntitlements.mockResolvedValue(enabledEntitlements);

      const result = await loadAdminContextV2();

      expect(result?.permissionSnapshot).toEqual({
        allow: ["superadmin.*"],
        deny: [],
      });
    });

    it("should synthesise empty allow when entitlements.enabled is false", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockLoadAdminEntitlements.mockResolvedValue(disabledEntitlements);

      const result = await loadAdminContextV2();

      expect(result?.permissionSnapshot).toEqual({
        allow: [],
        deny: [],
      });
    });

    it("should synthesise empty allow when entitlements is null (no admin row)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockLoadAdminEntitlements.mockResolvedValue(null);

      const result = await loadAdminContextV2();

      expect(result?.permissionSnapshot).toEqual({
        allow: [],
        deny: [],
      });
    });

    it("should NEVER have deny entries (synthetic snapshot is always deny-empty)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockLoadAdminEntitlements.mockResolvedValue(enabledEntitlements);

      const result = await loadAdminContextV2();

      expect(result?.permissionSnapshot.deny).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // User profile data
  // -------------------------------------------------------------------------
  describe("user profile data", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockLoadAdminEntitlements.mockResolvedValue(enabledEntitlements);
    });

    it("should return user profile fields from users table", async () => {
      const result = await loadAdminContextV2();

      expect(result?.user.first_name).toBe("Admin");
      expect(result?.user.last_name).toBe("User");
      expect(result?.user.avatar_url).toBe("https://example.com/avatar.png");
    });

    it("should return email from auth user", async () => {
      const result = await loadAdminContextV2();

      expect(result?.user.email).toBe("admin@example.com");
      expect(result?.user.id).toBe("user-123");
    });

    it("should fall back to user_metadata when users table returns null", async () => {
      mockUsersQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await loadAdminContextV2();

      expect(result?.user.first_name).toBe("Meta");
      expect(result?.user.last_name).toBe("Data");
    });

    it("should return null avatar when users table has no avatar and auth has none", async () => {
      mockUsersQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
      const userWithNoAvatar = {
        ...mockAuthUser,
        user_metadata: { first_name: "Meta", last_name: "Data" },
      };
      mockGetUser.mockResolvedValue({ data: { user: userWithNoAvatar }, error: null });

      const result = await loadAdminContextV2();

      expect(result?.user.avatar_url).toBeNull();
    });

    it("should handle null name fields gracefully when both sources are null", async () => {
      mockUsersQuery.maybeSingle.mockResolvedValue({
        data: { first_name: null, last_name: null, avatar_url: null, avatar_path: null },
        error: null,
      });
      const userWithoutMeta = { ...mockAuthUser, user_metadata: {} };
      mockGetUser.mockResolvedValue({ data: { user: userWithoutMeta }, error: null });

      const result = await loadAdminContextV2();

      expect(result?.user.first_name).toBeNull();
      expect(result?.user.last_name).toBeNull();
    });

    it("should query the correct user_id in the users table", async () => {
      await loadAdminContextV2();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("users");
      expect(mockUsersQuery.eq).toHaveBeenCalledWith("id", "user-123");
    });

    it("should pass userId to AdminEntitlementsService", async () => {
      await loadAdminContextV2();

      expect(mockLoadAdminEntitlements).toHaveBeenCalledWith(mockSupabaseClient, "user-123");
    });
  });

  // -------------------------------------------------------------------------
  // Full context shape
  // -------------------------------------------------------------------------
  describe("full context shape", () => {
    it("should return correct AdminContextV2 shape for enabled admin", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockLoadAdminEntitlements.mockResolvedValue(enabledEntitlements);

      const result = await loadAdminContextV2();

      expect(result).toMatchObject({
        user: {
          id: "user-123",
          email: "admin@example.com",
          first_name: "Admin",
          last_name: "User",
          avatar_url: "https://example.com/avatar.png",
          avatar_signed_url: null,
        },
        adminEntitlements: enabledEntitlements,
        permissionSnapshot: {
          allow: ["superadmin.*"],
          deny: [],
        },
      });
    });

    it("should include adminEntitlements as-is from service (null or object)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockLoadAdminEntitlements.mockResolvedValue(null);

      const result = await loadAdminContextV2();

      expect(result?.adminEntitlements).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Error resilience — fail-closed for security
  // -------------------------------------------------------------------------
  describe("error resilience (fail-closed)", () => {
    it("should still return context when users table query fails (profile is non-critical)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
      mockUsersQuery.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "RLS denied" },
      });
      mockLoadAdminEntitlements.mockResolvedValue(enabledEntitlements);

      // Profile failure is non-critical; falls back to metadata
      const result = await loadAdminContextV2();

      expect(result).not.toBeNull();
      expect(result?.permissionSnapshot.allow).toEqual(["superadmin.*"]);
    });
  });
});
