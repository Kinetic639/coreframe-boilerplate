/**
 * @vitest-environment node
 * Tests: src/app/api/read/[name]/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockAttachments, mockPeople } = vi.hoisted(() => ({
  mockAttachments: vi.fn(),
  mockPeople: vi.fn(),
}));

vi.mock("@/server/reads/registry", () => ({
  appReads: { attachments: mockAttachments, mentionPeople: mockPeople },
}));

import { GET, POST } from "../route";

const context = (name: string) => ({ params: Promise.resolve({ name }) });

function get(name: string, query = "") {
  return GET(new NextRequest(`http://localhost/api/read/${name}${query}`), context(name));
}

function post(name: string, body: string) {
  const request = new NextRequest(`http://localhost/api/read/${name}`, { method: "POST", body });
  return POST(request, context(name));
}

describe("/api/read/[name]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the JSON arguments to the read and returns its result", async () => {
    mockAttachments.mockResolvedValue({ success: true, data: [] });
    const input = { targetType: "planning.task", targetId: "t1" };
    const response = await get(
      "attachments",
      `?args=${encodeURIComponent(JSON.stringify([input]))}`
    );
    expect(mockAttachments).toHaveBeenCalledWith(input);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ success: true, data: [] });
  });

  it("takes long arguments from a POST body", async () => {
    mockAttachments.mockResolvedValue({ success: true, data: [] });
    await post("attachments", JSON.stringify([{ targetId: "t2" }]));
    expect(mockAttachments).toHaveBeenCalledWith({ targetId: "t2" });
  });

  it("calls a read without arguments when none are given", async () => {
    mockPeople.mockResolvedValue({ success: true, data: [] });
    await get("mentionPeople");
    expect(mockPeople).toHaveBeenCalledWith();
  });

  it("refuses names that are not registered reads", async () => {
    for (const name of ["addCommentAction", "toString", "__proto__"]) {
      expect((await get(name)).status).toBe(404);
    }
    expect(mockAttachments).not.toHaveBeenCalled();
  });

  it("refuses arguments that are not a JSON array", async () => {
    expect((await get("attachments", "?args=%7B%7D")).status).toBe(400);
    expect((await post("attachments", "not-json")).status).toBe(400);
    expect(mockAttachments).not.toHaveBeenCalled();
  });
});
