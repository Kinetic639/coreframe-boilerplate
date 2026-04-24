/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { generateQrToken } from "../token";

describe("generateQrToken", () => {
  it("returns a string", () => {
    expect(typeof generateQrToken()).toBe("string");
  });

  it("returns a 22-character string", () => {
    expect(generateQrToken()).toHaveLength(22);
  });

  it("returns only URL-safe base64url characters", () => {
    const token = generateQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique tokens across a sample of 200 calls", () => {
    const tokens = Array.from({ length: 200 }, () => generateQrToken());
    const unique = new Set(tokens);
    expect(unique.size).toBe(200);
  });
});
