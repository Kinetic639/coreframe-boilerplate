import { describe, it, expect } from "vitest";
import { classifyPostgrestError } from "@/lib/queries/types";

describe("classifyPostgrestError", () => {
  it("returns forbidden on HTTP 403", () => {
    expect(classifyPostgrestError(403, undefined, "forbidden")).toEqual({ kind: "forbidden" });
  });

  it("returns forbidden when SQLSTATE is 42501 (RLS denial)", () => {
    expect(classifyPostgrestError(400, "42501", "insufficient_privilege")).toEqual({
      kind: "forbidden",
    });
  });

  it("returns forbidden on 403 regardless of code", () => {
    expect(classifyPostgrestError(403, "42501", "any message")).toEqual({ kind: "forbidden" });
  });

  it("returns error with message for generic server errors", () => {
    expect(classifyPostgrestError(500, "PGRST000", "Internal error")).toEqual({
      kind: "error",
      message: "Internal error",
    });
  });

  it("returns error for 401 (auth issue, not RLS forbidden)", () => {
    expect(classifyPostgrestError(401, undefined, "JWT expired")).toEqual({
      kind: "error",
      message: "JWT expired",
    });
  });

  it("passes the message through on error", () => {
    const result = classifyPostgrestError(500, undefined, "something broke");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("something broke");
    }
  });
});
