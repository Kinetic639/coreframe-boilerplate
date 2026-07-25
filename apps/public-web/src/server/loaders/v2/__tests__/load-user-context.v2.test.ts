/**
 * @vitest-environment node
 *
 * Tests: load-user-context.v2.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const { mockGetUser, mockGetSession, mockFrom, mockStorage, mockGetPermissionSnapshot } =
  vi.hoisted(() => {
    const mockGetUser = vi.fn();
    const mockGetSession = vi.fn();
    const mockFrom = vi.fn();
    const mockStorage = {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null }),
      }),
    };
    const mockGetPermissionSnapshot = vi.fn();
    return { mockGetUser, mockGetSession, mockFrom, mockStorage, mockGetPermissionSnapshot };
  });

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser, getSession: mockGetSession },
    from: mockFrom,
    storage: mockStorage,
  }),
}));

vi.mock("@/server/services/auth.service", () => ({
  AuthService: { getUserRoles: vi.fn().mockReturnValue([]) },
}));

vi.mock("@/server/services/permission-v2.service", () => ({
  PermissionServiceV2: { getPermissionSnapshotForUser: mockGetPermissionSnapshot },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { loadUserContextV2 } from "../load-user-context.v2";
import { AuthService } from "@/server/services/auth.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTH_USER = {
  id: "user-1",
  email: "user@test.com",
  user_metadata: { first_name: "Jane", last_name: "Doe" },
};
const SESSION = { access_token: "tok-abc" };
const DB_USER = {
  id: "user-1",
  email: "user@test.com",
  first_name: "Jane",
  last_name: "Doe",
  avatar_url: null,
  avatar_path: null,
};

function setupDefault() {
  mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
  mockGetSession.mockResolvedValue({ data: { session: SESSION } });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: DB_USER, error: null }),
  });
  mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("loadUserContextV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset storage mock
    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null }),
    });
  });

  it("returns null when getUser fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT invalid" } });
    const result = await loadUserContextV2("org-1", null);
    expect(result).toBeNull();
  });

  it("returns null when user is null (unauthenticated)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await loadUserContextV2("org-1", null);
    expect(result).toBeNull();
  });

  it("returns null when session is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await loadUserContextV2("org-1", null);
    expect(result).toBeNull();
  });

  it("returns user from DB when found", async () => {
    setupDefault();
    const result = await loadUserContextV2("org-1", null);
    expect(result).not.toBeNull();
    expect(result!.user.id).toBe("user-1");
    expect(result!.user.first_name).toBe("Jane");
    expect(result!.user.email).toBe("user@test.com");
  });

  it("falls back to session metadata when DB user row missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: SESSION } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });

    const result = await loadUserContextV2("org-1", null);
    expect(result!.user.id).toBe("user-1");
    expect(result!.user.email).toBe("user@test.com");
    expect(result!.user.first_name).toBe("Jane"); // from user_metadata
  });

  it("logs error and continues when DB user query fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: SESSION } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "connection refused" } }),
    });
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });

    const result = await loadUserContextV2("org-1", null);
    // Falls back to auth metadata
    expect(result!.user.id).toBe("user-1");
  });

  it("generates signed URL when avatar_path is set", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: SESSION } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...DB_USER, avatar_path: "avatars/user-1.jpg" },
        error: null,
      }),
    });
    const mockCreateSigned = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://cdn.example.com/avatar.jpg" } });
    mockStorage.from.mockReturnValue({ createSignedUrl: mockCreateSigned });
    mockGetPermissionSnapshot.mockResolvedValue({ allow: [], deny: [] });

    const result = await loadUserContextV2("org-1", null);
    expect(result!.user.avatar_signed_url).toBe("https://cdn.example.com/avatar.jpg");
    expect(mockCreateSigned).toHaveBeenCalledWith("avatars/user-1.jpg", 3600);
  });

  it("returns empty permission snapshot when activeOrgId is null", async () => {
    setupDefault();
    const result = await loadUserContextV2(null, null);
    expect(result!.permissionSnapshot).toEqual({ allow: [], deny: [] });
    expect(mockGetPermissionSnapshot).not.toHaveBeenCalled();
  });

  it("loads permission snapshot when activeOrgId is provided", async () => {
    setupDefault();
    mockGetPermissionSnapshot.mockResolvedValue({ allow: ["org.*", "members.*"], deny: [] });

    const result = await loadUserContextV2("org-1", "branch-1");
    expect(result!.permissionSnapshot).toEqual({ allow: ["org.*", "members.*"], deny: [] });
    expect(mockGetPermissionSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "org-1",
      "branch-1"
    );
  });

  it("extracts roles from JWT via AuthService", async () => {
    setupDefault();
    vi.mocked(AuthService.getUserRoles).mockReturnValue([
      { name: "org_owner", scope: "org" } as never,
    ]);
    const result = await loadUserContextV2("org-1", null);
    expect(result!.roles).toEqual([{ name: "org_owner", scope: "org" }]);
    expect(AuthService.getUserRoles).toHaveBeenCalledWith("tok-abc");
  });
});
