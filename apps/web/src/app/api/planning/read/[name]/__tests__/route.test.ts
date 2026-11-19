/**
 * @vitest-environment node
 * Tests: src/app/api/planning/read/[name]/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockBoard, mockInbox } = vi.hoisted(() => ({
  mockBoard: vi.fn(),
  mockInbox: vi.fn(),
}));

vi.mock("@/server/planning/read-registry", () => ({
  planningReads: { board: mockBoard, inbox: mockInbox },
}));

import { GET } from "../route";

function call(name: string, query = "") {
  const request = new NextRequest(`http://localhost/api/planning/read/${name}${query}`);
  return GET(request, { params: Promise.resolve({ name }) });
}

describe("GET /api/planning/read/[name]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the JSON arguments to the read and returns its result", async () => {
    mockBoard.mockResolvedValue({ success: true, data: { id: "b1" } });
    const response = await call("board", `?args=${encodeURIComponent(JSON.stringify(["b1"]))}`);
    expect(mockBoard).toHaveBeenCalledWith("b1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ success: true, data: { id: "b1" } });
  });

  it("calls a read without arguments when none are given", async () => {
    mockInbox.mockResolvedValue({ success: true, data: [] });
    await call("inbox");
    expect(mockInbox).toHaveBeenCalledWith();
  });

  it("refuses names that are not registered reads", async () => {
    for (const name of ["deleteKanbanBoardAction", "toString", "__proto__"]) {
      const response = await call(name);
      expect(response.status).toBe(404);
    }
    expect(mockBoard).not.toHaveBeenCalled();
  });

  it("refuses arguments that are not a JSON array", async () => {
    expect((await call("board", "?args=%7B%7D")).status).toBe(400);
    expect((await call("board", "?args=not-json")).status).toBe(400);
    expect(mockBoard).not.toHaveBeenCalled();
  });
});
