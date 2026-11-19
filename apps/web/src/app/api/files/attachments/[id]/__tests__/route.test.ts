/**
 * @vitest-environment node
 * Tests: src/app/api/files/attachments/[id]/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockMaybeSingle, mockSign } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockSign: vi.fn(),
}));

vi.mock("@/server/storage/attachment-signed-url", () => ({
  ATTACHMENT_URL_REUSE_SECONDS: 3000,
  getSharedAttachmentUrl: mockSign,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => {
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      maybeSingle: mockMaybeSingle,
    };
    return { from: () => query };
  },
}));

import { GET } from "../route";

const ID = "3f0c2a52-8f0e-4a8f-9a59-0d6a3c1b2e11";

function call(id: string, query = "") {
  return GET(new NextRequest(`http://localhost/api/files/attachments/${id}${query}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/files/attachments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to a signed link and lets the browser cache the redirect", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { storage_path: "org/user/file.png" } });
    mockSign.mockResolvedValue("https://cdn.test/signed");
    const response = await call(ID);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://cdn.test/signed");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3000");
    expect(mockSign).toHaveBeenCalledWith("org/user/file.png");
  });

  it("redirects to the small version when one was stored", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        storage_path: "org/user/abc.webp",
        metadata: { variants: { thumb: { path: "org/user/abc.thumb.webp" } } },
      },
    });
    mockSign.mockResolvedValue("https://cdn.test/thumb");
    const response = await call(ID, "?v=thumb");
    expect(response.status).toBe(302);
    expect(mockSign).toHaveBeenCalledWith("org/user/abc.thumb.webp");
  });

  it("falls back to the stored file when there is no small version", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { storage_path: "org/user/abc.jpg", metadata: {} } });
    mockSign.mockResolvedValue("https://cdn.test/full");
    await call(ID, "?v=card");
    expect(mockSign).toHaveBeenCalledWith("org/user/abc.jpg");
  });

  it("ignores a variant path that is not next to the stored file", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        storage_path: "org/user/abc.jpg",
        metadata: { variants: { thumb: { path: "org/other/secret.thumb.webp" } } },
      },
    });
    mockSign.mockResolvedValue("https://cdn.test/full");
    await call(ID, "?v=thumb");
    expect(mockSign).toHaveBeenCalledWith("org/user/abc.jpg");
  });

  it("returns 404 when the user cannot see the attachment", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const response = await call(ID);
    expect(response.status).toBe(404);
    expect(mockSign).not.toHaveBeenCalled();
  });

  it("returns 404 for an id that is not a uuid", async () => {
    const response = await call("../secret");
    expect(response.status).toBe(404);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});
