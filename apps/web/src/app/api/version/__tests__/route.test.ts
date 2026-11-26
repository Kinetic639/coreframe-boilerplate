import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("GET /api/version", () => {
  it("answers with the build version and commit, never cached", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.4.0");
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "a1b2c3d4e5f6");
    const { GET } = await import("../route");
    const res = GET();

    expect(await res.json()).toEqual({ version: "1.4.0", commit: "a1b2c3d4e5f6" });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
