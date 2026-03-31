/**
 * @vitest-environment jsdom
 * Tests: src/lib/api/sync-ui-settings.ts
 *
 * Uses jsdom to provide navigator.sendBeacon and fetch globals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  saveUiSettingsToCloud,
  loadUiSettingsFromCloud,
  syncUiSettingsBeacon,
} from "../sync-ui-settings";

// ─── fetch mock helpers ───────────────────────────────────────────────────────

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
    statusText: "OK",
  });
}

function mockFetchError(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: "Error",
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error("network error"));
}

const VALID_SETTINGS = {
  theme: "dark" as const,
  clientUpdatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── saveUiSettingsToCloud ────────────────────────────────────────────────────

describe("saveUiSettingsToCloud", () => {
  it("returns SyncResult on successful response", async () => {
    const serverUpdatedAt = "2026-01-01T00:10:00.000Z";
    vi.stubGlobal("fetch", mockFetchOk({ success: true, serverUpdatedAt, revision: 1 }));

    const result = await saveUiSettingsToCloud(VALID_SETTINGS);

    expect(result).not.toBeNull();
    expect(result!.serverUpdatedAt).toBe(serverUpdatedAt);
    expect(result!.revision).toBe(1);
  });

  it("uses revision 0 as fallback when not provided", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({ success: true, serverUpdatedAt: "2026-01-01T00:00:00.000Z" })
    );

    const result = await saveUiSettingsToCloud(VALID_SETTINGS);
    expect(result!.revision).toBe(0);
  });

  it("sends POST to /api/ui-settings with correct payload", async () => {
    const fetchMock = mockFetchOk({
      success: true,
      serverUpdatedAt: "2026-01-01T00:00:00.000Z",
      revision: 0,
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveUiSettingsToCloud(VALID_SETTINGS);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ui-settings",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_SETTINGS),
        cache: "no-store",
      })
    );
  });

  it("returns null on non-ok HTTP response", async () => {
    vi.stubGlobal("fetch", mockFetchError(401, { error: "Unauthorized" }));

    const result = await saveUiSettingsToCloud(VALID_SETTINGS);
    expect(result).toBeNull();
  });

  it("returns null when response json() fails on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Server Error",
        json: vi.fn().mockRejectedValue(new Error("not json")),
      })
    );

    const result = await saveUiSettingsToCloud(VALID_SETTINGS);
    expect(result).toBeNull();
  });

  it("returns null when response success is false", async () => {
    vi.stubGlobal("fetch", mockFetchOk({ success: false, error: "Sync failed" }));

    const result = await saveUiSettingsToCloud(VALID_SETTINGS);
    expect(result).toBeNull();
  });

  it("returns null when serverUpdatedAt is missing from response", async () => {
    vi.stubGlobal("fetch", mockFetchOk({ success: true }));

    const result = await saveUiSettingsToCloud(VALID_SETTINGS);
    expect(result).toBeNull();
  });

  it("returns null on network error (fetch throws)", async () => {
    vi.stubGlobal("fetch", mockFetchNetworkError());

    const result = await saveUiSettingsToCloud(VALID_SETTINGS);
    expect(result).toBeNull();
  });
});

// ─── loadUiSettingsFromCloud ──────────────────────────────────────────────────

describe("loadUiSettingsFromCloud", () => {
  it("returns FetchResult on successful response with settings", async () => {
    const ui = { theme: "dark", colorTheme: "ocean" };
    const serverUpdatedAt = "2026-01-01T00:00:00.000Z";
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        success: true,
        data: { ui, serverUpdatedAt, revision: 2 },
      })
    );

    const result = await loadUiSettingsFromCloud();

    expect(result).not.toBeNull();
    expect(result!.ui).toEqual(ui);
    expect(result!.serverUpdatedAt).toBe(serverUpdatedAt);
    expect(result!.revision).toBe(2);
  });

  it("returns null ui and serverUpdatedAt when data fields are missing", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        success: true,
        data: { ui: null, serverUpdatedAt: null, revision: 0 },
      })
    );

    const result = await loadUiSettingsFromCloud();

    expect(result!.ui).toBeNull();
    expect(result!.serverUpdatedAt).toBeNull();
    expect(result!.revision).toBe(0);
  });

  it("sends GET to /api/ui-settings with no-store cache", async () => {
    const fetchMock = mockFetchOk({ success: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);

    await loadUiSettingsFromCloud();

    expect(fetchMock).toHaveBeenCalledWith("/api/ui-settings", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("returns null on non-ok HTTP response", async () => {
    vi.stubGlobal("fetch", mockFetchError(401, { error: "Unauthorized" }));

    const result = await loadUiSettingsFromCloud();
    expect(result).toBeNull();
  });

  it("returns null when response json() fails on error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Error",
        json: vi.fn().mockRejectedValue(new Error("not json")),
      })
    );

    const result = await loadUiSettingsFromCloud();
    expect(result).toBeNull();
  });

  it("returns null when response success is false", async () => {
    vi.stubGlobal("fetch", mockFetchOk({ success: false, error: "Failed to fetch UI settings" }));

    const result = await loadUiSettingsFromCloud();
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", mockFetchNetworkError());

    const result = await loadUiSettingsFromCloud();
    expect(result).toBeNull();
  });

  it("uses fallback revision 0 when revision missing from data", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        success: true,
        data: { ui: null, serverUpdatedAt: null },
      })
    );

    const result = await loadUiSettingsFromCloud();
    expect(result!.revision).toBe(0);
  });
});

// ─── syncUiSettingsBeacon ─────────────────────────────────────────────────────

describe("syncUiSettingsBeacon", () => {
  it("returns true when sendBeacon succeeds", () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });

    const result = syncUiSettingsBeacon(VALID_SETTINGS);

    expect(result).toBe(true);
    expect(sendBeaconMock).toHaveBeenCalledWith("/api/ui-settings", expect.any(Blob));
  });

  it("returns false when sendBeacon returns false (queue full)", () => {
    vi.stubGlobal("navigator", { sendBeacon: vi.fn().mockReturnValue(false) });

    const result = syncUiSettingsBeacon(VALID_SETTINGS);
    expect(result).toBe(false);
  });

  it("returns false when sendBeacon throws", () => {
    vi.stubGlobal("navigator", {
      sendBeacon: vi.fn().mockImplementation(() => {
        throw new Error("sendBeacon not available");
      }),
    });

    const result = syncUiSettingsBeacon(VALID_SETTINGS);
    expect(result).toBe(false);
  });

  it("sends JSON-serialised payload as Blob", () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });

    syncUiSettingsBeacon(VALID_SETTINGS);

    const blob: Blob = sendBeaconMock.mock.calls[0][1];
    expect(blob.type).toBe("application/json");
  });
});
