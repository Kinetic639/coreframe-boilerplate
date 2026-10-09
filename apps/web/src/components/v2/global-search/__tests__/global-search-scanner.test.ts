import { describe, expect, it } from "vitest";
import { classifyScannedCode } from "../global-search-scanner";

describe("classifyScannedCode", () => {
  it("recognizes an Ambra QR label by its /qr/<token> path", () => {
    expect(classifyScannedCode("https://www.ambra-system.com/qr/abc%2Fdef")).toEqual({
      kind: "ambraQr",
      token: "abc/def",
    });
    expect(classifyScannedCode("https://localhost:3000/pl/qr/tok123/")).toEqual({
      kind: "ambraQr",
      token: "tok123",
    });
  });

  it("treats every other code as search text", () => {
    expect(classifyScannedCode(" 2K5807221KGRU ")).toEqual({ kind: "text", text: "2K5807221KGRU" });
    expect(classifyScannedCode("5901234123457")).toEqual({ kind: "text", text: "5901234123457" });
    expect(classifyScannedCode("https://example.com/product/1")).toEqual({
      kind: "text",
      text: "https://example.com/product/1",
    });
  });

  it("ignores empty reads and caps very long ones", () => {
    expect(classifyScannedCode("   ")).toBeNull();
    expect(classifyScannedCode("x".repeat(200))).toEqual({ kind: "text", text: "x".repeat(80) });
  });
});
