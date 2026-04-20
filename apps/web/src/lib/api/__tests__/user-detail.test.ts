/**
 * @vitest-environment node
 * Tests: src/lib/api/user-detail.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- hoisted mocks ---
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

import {
  updateUserProfile,
  updateUserStatus,
  assignUserRole,
  removeUserRole,
  upsertPermissionOverride,
  removePermissionOverride,
  fetchAvailableRoles,
  fetchAvailablePermissions,
} from "../user-detail";

// Helper: build a fluent chain mock that resolves at the terminal call
function makeChain(result: { data?: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "update", "insert", "upsert", "delete", "eq", "or", "is", "order"];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  // terminal — return a resolved promise with the result
  Object.assign(chain, {
    then: undefined, // not thenable itself
    // make the last chained call resolve
  });
  // Override the last method to return a promise
  // We use a simpler approach: every method returns the chain, and the chain itself
  // acts as a thenable by overriding the last .order / .eq call to resolve.
  // Actually, simplest: just make each terminal method resolve directly.
  const terminal = vi.fn().mockResolvedValue(result);
  methods.forEach((m) => {
    (chain[m] as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      ...chain,
      eq: vi.fn().mockResolvedValue(result),
      or: vi.fn().mockReturnValue({
        ...chain,
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: terminal,
          }),
        }),
      }),
      is: vi.fn().mockReturnValue({
        order: terminal,
      }),
      order: terminal,
      then: undefined,
    }));
  });
  return { chain, terminal };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── updateUserProfile ────────────────────────────────────────────────────────

describe("updateUserProfile", () => {
  it("resolves without error on success", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await expect(
      updateUserProfile("u1", { first_name: "Jane", last_name: "Doe" })
    ).resolves.toBeUndefined();
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "db fail" } }),
      }),
    });

    await expect(updateUserProfile("u1", { first_name: "Jane" })).rejects.toThrow(
      "Failed to update user profile: db fail"
    );
  });

  it("filters out undefined values", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });

    await updateUserProfile("u1", { first_name: "Jane", last_name: undefined });

    expect(updateMock).toHaveBeenCalledWith({ first_name: "Jane" });
  });
});

// ─── updateUserStatus ─────────────────────────────────────────────────────────

describe("updateUserStatus", () => {
  it("resolves without error on success", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await expect(updateUserStatus("u1", "active")).resolves.toBeUndefined();
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "status fail" } }),
      }),
    });

    await expect(updateUserStatus("u1", "active")).rejects.toThrow(
      "Failed to update user status: status fail"
    );
  });
});

// ─── assignUserRole ───────────────────────────────────────────────────────────

describe("assignUserRole", () => {
  it("resolves without error on success", async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    await expect(assignUserRole("u1", "r1", "org", "s1")).resolves.toBeUndefined();
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: "insert fail" } }),
    });

    await expect(assignUserRole("u1", "r1", "org", "s1")).rejects.toThrow(
      "Failed to assign role: insert fail"
    );
  });

  it("inserts correct payload", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertMock });

    await assignUserRole("u1", "r1", "branch", "b1");

    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      role_id: "r1",
      scope: "branch",
      scope_id: "b1",
    });
  });
});

// ─── removeUserRole ───────────────────────────────────────────────────────────

describe("removeUserRole", () => {
  it("resolves without error on success", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await expect(removeUserRole("a1")).resolves.toBeUndefined();
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "remove fail" } }),
      }),
    });

    await expect(removeUserRole("a1")).rejects.toThrow("Failed to remove role: remove fail");
  });
});

// ─── upsertPermissionOverride ─────────────────────────────────────────────────

describe("upsertPermissionOverride", () => {
  it("resolves without error on success (org scope)", async () => {
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    await expect(upsertPermissionOverride("u1", "org1", "p1", true)).resolves.toBeUndefined();
  });

  it("uses branch scope when branchId provided", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertMock });

    await upsertPermissionOverride("u1", "org1", "p1", true, "b1");

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "branch", scope_id: "b1" })
    );
  });

  it("uses org scope when branchId is null", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertMock });

    await upsertPermissionOverride("u1", "org1", "p1", false, null);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "org", scope_id: "org1" })
    );
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { message: "upsert fail" } }),
    });

    await expect(upsertPermissionOverride("u1", "org1", "p1", true)).rejects.toThrow(
      "Failed to update permission override: upsert fail"
    );
  });
});

// ─── removePermissionOverride ─────────────────────────────────────────────────

describe("removePermissionOverride", () => {
  it("resolves without error on success", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await expect(removePermissionOverride("o1")).resolves.toBeUndefined();
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "del fail" } }),
      }),
    });

    await expect(removePermissionOverride("o1")).rejects.toThrow(
      "Failed to remove permission override: del fail"
    );
  });
});

// ─── fetchAvailableRoles ──────────────────────────────────────────────────────

describe("fetchAvailableRoles", () => {
  it("returns roles on success", async () => {
    const roles = [{ id: "r1", name: "admin" }];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: roles, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await fetchAvailableRoles("org1");
    expect(result).toEqual(roles);
  });

  it("returns empty array when data is null", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await fetchAvailableRoles("org1");
    expect(result).toEqual([]);
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: "roles fail" } }),
            }),
          }),
        }),
      }),
    });

    await expect(fetchAvailableRoles("org1")).rejects.toThrow("Failed to fetch roles: roles fail");
  });
});

// ─── fetchAvailablePermissions ────────────────────────────────────────────────

describe("fetchAvailablePermissions", () => {
  it("returns permissions on success", async () => {
    const perms = [{ id: "p1", slug: "read" }];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: perms, error: null }),
        }),
      }),
    });

    const result = await fetchAvailablePermissions();
    expect(result).toEqual(perms);
  });

  it("returns empty array when data is null", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const result = await fetchAvailablePermissions();
    expect(result).toEqual([]);
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "perms fail" } }),
        }),
      }),
    });

    await expect(fetchAvailablePermissions()).rejects.toThrow(
      "Failed to fetch permissions: perms fail"
    );
  });
});
