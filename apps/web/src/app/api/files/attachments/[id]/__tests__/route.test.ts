/**
 * @vitest-environment node
 * Tests: src/app/api/files/attachments/[id]/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockMaybeSingle, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => {
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      maybeSingle: mockMaybeSingle,
    };
    return {
      from: () => query,
      storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
    };
  },
}));

import { GET } from "../route";

const ID = "3f0c2a52-8f0e-4a8f-9a59-0d6a3c1b2e11";

function call(id: string) {
  return GET(new NextRequest(`http://localhost/api/files/attachments/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/files/attachments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to a signed link and lets the browser cache the redirect", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { storage_path: "org/user/file.png" } });
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://cdn.test/signed" } });
    const response = await call(ID);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://cdn.test/signed");
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("org/user/file.png", 3600);
  });

  it("returns 404 when the user cannot see the attachment", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const response = await call(ID);
    expect(response.status).toBe(404);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("returns 404 for an id that is not a uuid", async () => {
    const response = await call("../secret");
    expect(response.status).toBe(404);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});
