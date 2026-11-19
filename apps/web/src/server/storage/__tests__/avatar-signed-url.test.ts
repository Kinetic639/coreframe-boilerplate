import { describe, it, expect, vi, beforeEach } from "vitest";

const createSignedUrl = vi.fn();
const createSignedUrls = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({ storage: { from: () => ({ createSignedUrl, createSignedUrls }) } }),
}));

import { getSignedAvatarUrl, getSignedAvatarUrls } from "../avatar-signed-url";

describe("getSignedAvatarUrl", () => {
  beforeEach(() => createSignedUrl.mockReset());

  it("signs a path in the user's own folder for one hour", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://s/a.webp" }, error: null });
    await expect(getSignedAvatarUrl("u1", "u1/a.webp")).resolves.toBe("https://s/a.webp");
    expect(createSignedUrl).toHaveBeenCalledWith("u1/a.webp", 3600);
  });

  it("refuses a path outside the user's folder", async () => {
    await expect(getSignedAvatarUrl("u1", "u2/a.webp")).resolves.toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns null when signing fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createSignedUrl.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(getSignedAvatarUrl("u1", "u1/a.webp")).resolves.toBeNull();
  });
});

describe("getSignedAvatarUrls", () => {
  beforeEach(() => createSignedUrls.mockReset());

  it("signs the owned paths in one call and maps them back to users", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ signedUrl: "https://s/u1" }, { signedUrl: "https://s/u2" }],
      error: null,
    });

    const result = await getSignedAvatarUrls([
      { userId: "u2", avatarPath: "u2/b.jpg" },
      { userId: "u1", avatarPath: "u1/a.webp" },
      { userId: "u3", avatarPath: "u9/x.jpg" },
    ]);

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(["u1/a.webp", "u2/b.jpg"], 3600);
    expect(result.get("u1")).toBe("https://s/u1");
    expect(result.get("u2")).toBe("https://s/u2");
    expect(result.has("u3")).toBe(false);
  });

  it("returns an empty map when signing fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createSignedUrls.mockResolvedValue({ data: null, error: new Error("boom") });
    const result = await getSignedAvatarUrls([{ userId: "u1", avatarPath: "u1/a.webp" }]);
    expect(result.size).toBe(0);
  });
});
