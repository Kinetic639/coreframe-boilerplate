import { describe, it, expect, vi } from "vitest";

const { cacheCalls } = vi.hoisted(() => ({ cacheCalls: [] as unknown[][] }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      cacheCalls.push(args);
      return fn(...args);
    },
}));
vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://s/f" }, error: null }),
      }),
    },
  }),
}));

import {
  ATTACHMENT_URL_REUSE_SECONDS,
  attachmentUrlWindow,
  getSharedAttachmentUrl,
} from "../attachment-signed-url";

const WINDOW_MS = ATTACHMENT_URL_REUSE_SECONDS * 1000;

describe("shared attachment links", () => {
  it("keys the cached link by the current window, so an old link is never handed out", async () => {
    await expect(getSharedAttachmentUrl("a/b.png")).resolves.toBe("https://s/f");
    expect(cacheCalls.at(-1)).toEqual(["a/b.png", attachmentUrlWindow()]);
  });

  it("moves to a new window every 50 minutes", () => {
    const start = 1000 * WINDOW_MS;
    expect(attachmentUrlWindow(start)).toBe(1000);
    expect(attachmentUrlWindow(start + WINDOW_MS - 1)).toBe(1000);
    expect(attachmentUrlWindow(start + WINDOW_MS)).toBe(1001);
  });
});
