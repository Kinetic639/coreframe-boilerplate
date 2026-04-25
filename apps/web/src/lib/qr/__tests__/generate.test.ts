/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { generateQrPngDataUrl, generateQrSvgString } from "../generate";

const SAMPLE_TOKEN = "AbCdEfGhIjKlMnOpQrSt12";

describe("generateQrPngDataUrl", () => {
  it("returns a data URL with correct prefix", async () => {
    const result = await generateQrPngDataUrl(SAMPLE_TOKEN);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("base64 payload is non-empty", async () => {
    const result = await generateQrPngDataUrl(SAMPLE_TOKEN);
    const base64 = result.replace("data:image/png;base64,", "");
    expect(base64.length).toBeGreaterThan(100);
  });

  it("produces the same output for the same token (deterministic)", async () => {
    const a = await generateQrPngDataUrl(SAMPLE_TOKEN);
    const b = await generateQrPngDataUrl(SAMPLE_TOKEN);
    expect(a).toBe(b);
  });

  it("produces different output for different tokens", async () => {
    const a = await generateQrPngDataUrl("tokenAAAAAAAAAAAAAAAA11");
    const b = await generateQrPngDataUrl("tokenBBBBBBBBBBBBBBBB22");
    expect(a).not.toBe(b);
  });

  it("throws a clean error for an empty token", async () => {
    await expect(generateQrPngDataUrl("")).rejects.toThrow("non-empty string");
  });

  it("throws a clean error for a whitespace-only token", async () => {
    await expect(generateQrPngDataUrl("   ")).rejects.toThrow("non-empty string");
  });
});

describe("generateQrSvgString", () => {
  it("returns a string containing an SVG root element", async () => {
    const result = await generateQrSvgString(SAMPLE_TOKEN);
    expect(result).toContain("<svg");
  });

  it("returns valid SVG with closing tag", async () => {
    const result = await generateQrSvgString(SAMPLE_TOKEN);
    expect(result).toContain("</svg>");
  });

  it("produces different output for different tokens", async () => {
    const a = await generateQrSvgString("tokenAAAAAAAAAAAAAAAA11");
    const b = await generateQrSvgString("tokenBBBBBBBBBBBBBBBB22");
    expect(a).not.toBe(b);
  });

  it("throws a clean error for an empty token", async () => {
    await expect(generateQrSvgString("")).rejects.toThrow("non-empty string");
  });
});
