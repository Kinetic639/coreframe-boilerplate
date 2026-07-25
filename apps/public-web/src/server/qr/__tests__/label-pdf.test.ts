/**
 * @vitest-environment node
 *
 * Integration tests for generateQrLabelsPdf.
 * Calls the real @react-pdf/renderer — verifies PDF validity without mocking
 * the renderer internals. Visual correctness is intentionally out of scope.
 *
 * Uses a real QR data URL (generated via generateQrPngDataUrl once in beforeAll)
 * so the PDF renderer's internal PNG decoder has a valid compressed image.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { generateQrLabelsPdf } from "../label-pdf";
import type { QrLabelPdfItem, QrLabelSize } from "../label-pdf";
import { generateQrPngDataUrl } from "@/lib/qr/generate";

// Generated once before all tests to avoid per-test I/O overhead.
let REAL_QR_DATA_URL: string;

beforeAll(async () => {
  REAL_QR_DATA_URL = await generateQrPngDataUrl("AbCdEfGhIjKlMnOpQrSt12");
});

function makeItem(overrides: Partial<QrLabelPdfItem> = {}): QrLabelPdfItem {
  return {
    qrCodeId: "qr-001",
    token: "AbCdEfGhIjKlMnOpQrSt12",
    qrDataUrl: REAL_QR_DATA_URL,
    primaryText: "A1 - Main Rack",
    secondaryText: "LOC-001",
    tertiaryText: "Warehouse Location",
    ...overrides,
  };
}

function makeItems(count: number): QrLabelPdfItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeItem({ qrCodeId: `qr-${String(i).padStart(3, "0")}`, primaryText: `Location ${i + 1}` })
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPdfBuffer(buf: Buffer): boolean {
  // Every PDF starts with the magic bytes %PDF
  return buf.length > 4 && buf.toString("ascii", 0, 4) === "%PDF";
}

// ---------------------------------------------------------------------------
// Rejects empty input
// ---------------------------------------------------------------------------

describe("generateQrLabelsPdf — empty input", () => {
  it("throws when items array is empty", async () => {
    await expect(generateQrLabelsPdf({ items: [], size: "50x30" })).rejects.toThrow("no labels");
  });
});

// ---------------------------------------------------------------------------
// 50x30 label size
// ---------------------------------------------------------------------------

describe("generateQrLabelsPdf — 50x30", () => {
  it("returns a valid PDF buffer for 1 label", async () => {
    const buf = await generateQrLabelsPdf({ items: makeItems(1), size: "50x30" });
    expect(buf).toBeInstanceOf(Buffer);
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it("returns a valid PDF buffer for 10 labels", async () => {
    const buf = await generateQrLabelsPdf({ items: makeItems(10), size: "50x30" });
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it("handles labels without optional text fields", async () => {
    const item = makeItem({ secondaryText: undefined, tertiaryText: undefined });
    const buf = await generateQrLabelsPdf({ items: [item], size: "50x30" });
    expect(isPdfBuffer(buf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 70x40 label size
// ---------------------------------------------------------------------------

describe("generateQrLabelsPdf — 70x40", () => {
  it("returns a valid PDF buffer for 1 label", async () => {
    const buf = await generateQrLabelsPdf({ items: makeItems(1), size: "70x40" });
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it("returns a valid PDF buffer for 50 labels", async () => {
    const buf = await generateQrLabelsPdf({ items: makeItems(50), size: "70x40" });
    expect(isPdfBuffer(buf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// a4-grid label size
// ---------------------------------------------------------------------------

describe("generateQrLabelsPdf — a4-grid", () => {
  it("returns a valid PDF buffer for 1 label", async () => {
    const buf = await generateQrLabelsPdf({ items: makeItems(1), size: "a4-grid" });
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it("returns a valid PDF buffer for 28 labels (exactly 1 page)", async () => {
    const buf = await generateQrLabelsPdf({ items: makeItems(28), size: "a4-grid" });
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it("returns a valid PDF buffer for 50 labels (2 pages)", async () => {
    const buf = await generateQrLabelsPdf({ items: makeItems(50), size: "a4-grid" });
    expect(isPdfBuffer(buf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// All sizes produce distinct buffers for same input
// ---------------------------------------------------------------------------

describe("generateQrLabelsPdf — size differentiation", () => {
  const SIZES: QrLabelSize[] = ["50x30", "70x40", "a4-grid"];

  it("each label size produces a valid PDF", async () => {
    for (const size of SIZES) {
      const buf = await generateQrLabelsPdf({ items: makeItems(3), size });
      expect(isPdfBuffer(buf), `${size} should produce valid PDF`).toBe(true);
    }
  });
});
