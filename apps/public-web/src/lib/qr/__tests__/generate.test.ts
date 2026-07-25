/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_LABEL_CONFIG } from "../label-config";
import {
  buildQrScanUrl,
  generateQrPngDataUrl,
  generateQrSvgString,
  generateStyledQrPngDataUrl,
  generateStyledQrSvgDataUrl,
} from "../generate";

const SAMPLE_TOKEN = "AbCdEfGhIjKlMnOpQrSt12";

describe("buildQrScanUrl", () => {
  it("builds a public QR scan URL from the token", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.ambra-system.com/";
    expect(buildQrScanUrl(SAMPLE_TOKEN)).toBe(
      "https://www.ambra-system.com/qr/AbCdEfGhIjKlMnOpQrSt12"
    );
  });

  it("encodes URL-unsafe token characters", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.ambra-system.com";
    expect(buildQrScanUrl("abc/def?ghi")).toBe("https://www.ambra-system.com/qr/abc%2Fdef%3Fghi");
  });
});

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

describe("generateStyledQrSvgDataUrl", () => {
  it("returns a data URL with correct SVG prefix", async () => {
    const result = await generateStyledQrSvgDataUrl(SAMPLE_TOKEN);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("produces the same output for the same token", async () => {
    const a = await generateStyledQrSvgDataUrl(SAMPLE_TOKEN);
    const b = await generateStyledQrSvgDataUrl(SAMPLE_TOKEN);
    expect(a).toBe(b);
  });

  it("throws a clean error for a whitespace-only token", async () => {
    await expect(generateStyledQrSvgDataUrl("   ")).rejects.toThrow("non-empty string");
  });
});

describe("generateStyledQrPngDataUrl", () => {
  it("returns a data URL with correct PNG prefix", async () => {
    const result = await generateStyledQrPngDataUrl(SAMPLE_TOKEN, DEFAULT_LABEL_CONFIG.qrStyle);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("produces the same output for the same token and style", async () => {
    const a = await generateStyledQrPngDataUrl(SAMPLE_TOKEN, DEFAULT_LABEL_CONFIG.qrStyle);
    const b = await generateStyledQrPngDataUrl(SAMPLE_TOKEN, DEFAULT_LABEL_CONFIG.qrStyle);
    expect(a).toBe(b);
  });

  it("produces different output for materially different styles", async () => {
    const a = await generateStyledQrPngDataUrl(SAMPLE_TOKEN, {
      frameShape: "square",
      dotStyle: "square",
      cornerSquareStyle: "square",
      cornerDotStyle: "square",
    });
    const b = await generateStyledQrPngDataUrl(SAMPLE_TOKEN, {
      frameShape: "circle",
      dotStyle: "dots",
      cornerSquareStyle: "extra-rounded",
      cornerDotStyle: "dot",
    });
    expect(a).not.toBe(b);
  });
});
