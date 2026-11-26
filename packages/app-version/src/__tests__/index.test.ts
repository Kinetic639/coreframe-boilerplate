import { describe, expect, it } from "vitest";
import { APP_VERSION, RELEASES, compareVersions, formatVersion, releasesSince } from "../index";

describe("app version", () => {
  it("matches the newest changelog entry", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(RELEASES[0]?.version).toBe(APP_VERSION);
  });

  it("formats with and without a commit", () => {
    expect(formatVersion("1.4.0", "a1b2c3d4e5f6")).toBe("1.4.0 (a1b2c3d)");
    expect(formatVersion("1.4.0", "")).toBe("1.4.0");
    expect(formatVersion("1.4.0")).toBe("1.4.0");
  });

  it("compares versions numerically", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.3", "2.0.0")).toBeLessThan(0);
  });

  it("lists releases newer than the last one seen", () => {
    const releases = [
      { version: "1.2.0", date: null, groups: [] },
      { version: "1.1.0", date: null, groups: [] },
      { version: "1.0.0", date: null, groups: [] },
    ];
    expect(releasesSince("1.0.0", releases).map((r) => r.version)).toEqual(["1.2.0", "1.1.0"]);
    expect(releasesSince(null, releases)).toEqual([]);
  });
});
