import { describe, it, expect, vi, beforeEach } from "vitest";

const createSignedUrl = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({ storage: { from: () => ({ createSignedUrl }) } }),
}));

import { getSignedAvatarUrl } from "../avatar-signed-url";

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
