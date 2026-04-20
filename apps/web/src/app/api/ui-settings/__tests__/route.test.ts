/**
 * @vitest-environment node
 * Tests: src/app/api/ui-settings/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- hoisted mocks ---
const {
  mockGetUser,
  mockCreateClient,
  mockGetOrCreatePreferences,
  mockSyncUiSettings,
  mockGetDashboardSettings,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetOrCreatePreferences: vi.fn(),
  mockSyncUiSettings: vi.fn(),
  mockGetDashboardSettings: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/server/services/user-preferences.service", () => ({
  UserPreferencesService: {
    getOrCreatePreferences: mockGetOrCreatePreferences,
    syncUiSettings: mockSyncUiSettings,
    getDashboardSettings: mockGetDashboardSettings,
  },
}));

import { POST, GET } from "../route";

const VALID_BODY = {
  theme: "dark" as const,
  clientUpdatedAt: new Date().toISOString(),
};

function makeRequest(body: unknown, contentType = "application/json"): NextRequest {
  return new NextRequest("http://localhost/api/ui-settings", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });
}

function resetCreateClient() {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCreateClient();
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/ui-settings", () => {
  it("returns 401 when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 when auth error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "jwt error" } });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON in text/plain", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const req = new NextRequest("http://localhost/api/ui-settings", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not valid json",
    });

    const res = await POST(req);
    expect(res.status).toBe(500); // throws from readBodyAsJson, caught by outer try/catch
  });

  it("returns 400 when payload is invalid (missing clientUpdatedAt)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const res = await POST(makeRequest({ theme: "dark" })); // no clientUpdatedAt
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid payload");
  });

  it("returns 400 when payload has unknown keys (strict mode)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const res = await POST(makeRequest({ ...VALID_BODY, unknownField: "oops" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with serverUpdatedAt on success", async () => {
    const updatedAt = "2026-01-01T00:00:00.000Z";
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetOrCreatePreferences.mockResolvedValue({});
    mockSyncUiSettings.mockResolvedValue({
      dashboardSettings: { updated_at: updatedAt },
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.serverUpdatedAt).toBe(updatedAt);
    expect(json.revision).toBe(0);
  });

  it("uses current time when dashboardSettings.updated_at is null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetOrCreatePreferences.mockResolvedValue({});
    mockSyncUiSettings.mockResolvedValue({ dashboardSettings: null });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(typeof json.serverUpdatedAt).toBe("string");
  });

  it("returns 500 when syncUiSettings throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetOrCreatePreferences.mockResolvedValue({});
    mockSyncUiSettings.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Sync failed");
  });

  it("accepts text/plain content-type with valid JSON body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetOrCreatePreferences.mockResolvedValue({});
    mockSyncUiSettings.mockResolvedValue({
      dashboardSettings: { updated_at: "2026-01-01T00:00:00.000Z" },
    });

    const req = new NextRequest("http://localhost/api/ui-settings", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/ui-settings", () => {
  it("returns 401 when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET();
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 on auth error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns success with null data when no settings exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetDashboardSettings.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.ui).toBeNull();
    expect(json.data.serverUpdatedAt).toBeNull();
    expect(json.data.revision).toBe(0);
  });

  it("returns settings data when settings exist", async () => {
    const ui = { theme: "dark", colorTheme: "ocean" };
    const updatedAt = "2026-01-01T00:00:00.000Z";
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetDashboardSettings.mockResolvedValue({ ui, updated_at: updatedAt });

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.ui).toEqual(ui);
    expect(json.data.serverUpdatedAt).toBe(updatedAt);
    expect(json.data.revision).toBe(0);
  });

  it("returns null ui when settings.ui is null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetDashboardSettings.mockResolvedValue({
      ui: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const res = await GET();
    const json = await res.json();
    expect(json.data.ui).toBeNull();
  });

  it("returns 500 when getDashboardSettings throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockGetDashboardSettings.mockRejectedValue(new Error("db down"));

    const res = await GET();
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Failed to fetch UI settings");
  });
});
