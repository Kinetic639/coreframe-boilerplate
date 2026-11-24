/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { generateZplLabels, zplPrintCommands } from "../zpl";
import { DEFAULT_LABEL_CONFIG } from "../label-config";
import type { ZplLabelItem } from "../zpl";

const TOKEN = "AbCdEfGhIjKlMnOpQrSt12";

function makeItem(overrides: Partial<ZplLabelItem> = {}): ZplLabelItem {
  return {
    token: TOKEN,
    fields: { primary: "Rack A1" },
    ...overrides,
  };
}

describe("generateZplLabels", () => {
  it("throws for empty item list", async () => {
    await expect(generateZplLabels([], "50x30", DEFAULT_LABEL_CONFIG)).rejects.toThrow("no labels");
  });

  it("returns a string", async () => {
    const zpl = await generateZplLabels([makeItem()], "50x30", DEFAULT_LABEL_CONFIG);
    expect(typeof zpl).toBe("string");
  });

  it("contains ^XA and ^XZ markers for each label", async () => {
    const zpl = await generateZplLabels([makeItem(), makeItem()], "50x30", DEFAULT_LABEL_CONFIG);
    const starts = (zpl.match(/\^XA/g) ?? []).length;
    const ends = (zpl.match(/\^XZ/g) ?? []).length;
    expect(starts).toBe(2);
    expect(ends).toBe(2);
  });

  it("embeds a bitmap graphic command", async () => {
    const zpl = await generateZplLabels([makeItem()], "50x30", DEFAULT_LABEL_CONFIG);
    expect(zpl).toContain("^GFA");
  });

  it("includes ^PW (print width) for each label", async () => {
    const zpl = await generateZplLabels([makeItem()], "50x30", DEFAULT_LABEL_CONFIG);
    expect(zpl).toContain("^PW");
  });

  it("includes label home origin and label length", async () => {
    const zpl = await generateZplLabels([makeItem()], "70x40", DEFAULT_LABEL_CONFIG);
    expect(zpl).toContain("^LH0,0");
    expect(zpl).toContain("^LL");
  });

  it("renders fixed thermal sizes differently", async () => {
    const a = await generateZplLabels([makeItem()], "50x30", DEFAULT_LABEL_CONFIG);
    const b = await generateZplLabels([makeItem()], "70x40", DEFAULT_LABEL_CONFIG);
    expect(a).not.toBe(b);
  });

  it("changes output when thermal label styling changes", async () => {
    const a = await generateZplLabels(
      [makeItem({ fields: { primary: "Rack A1", secondary: TOKEN.slice(0, 8) } })],
      "70x40",
      DEFAULT_LABEL_CONFIG
    );
    const b = await generateZplLabels(
      [makeItem({ fields: { primary: "Rack A1", secondary: TOKEN.slice(0, 8) } })],
      "70x40",
      {
        ...DEFAULT_LABEL_CONFIG,
        includeLogo: false,
        qrStyle: {
          frameShape: "circle",
          dotStyle: "dots",
          cornerSquareStyle: "square",
          cornerDotStyle: "square",
        },
      }
    );
    expect(a).not.toBe(b);
  });

  it("handles 12 labels without error", async () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem({
        token: `token${String(i).padStart(20, "0")}`,
        fields: { primary: `Rack ${i}` },
      })
    );
    const zpl = await generateZplLabels(items, "70x40", DEFAULT_LABEL_CONFIG);
    const count = (zpl.match(/\^XA/g) ?? []).length;
    expect(count).toBe(12);
  });
});

describe("zplPrintCommands", () => {
  it("slows the printer down by default and keeps its darkness and mode", () => {
    expect(zplPrintCommands(DEFAULT_LABEL_CONFIG)).toEqual(["^PR2,2,2"]);
  });

  it("sends speed, darkness and ribbon mode when set", () => {
    const config = {
      ...DEFAULT_LABEL_CONFIG,
      zpl: { speed: 3 as const, darkness: 8, media: "transfer" as const },
    };
    expect(zplPrintCommands(config)).toEqual(["^PR3,3,3", "~SD08", "^MTT"]);
  });

  it("puts the settings into every label", async () => {
    const config = {
      ...DEFAULT_LABEL_CONFIG,
      zpl: { speed: 2 as const, darkness: 25, media: "direct" as const },
    };
    const zpl = await generateZplLabels([makeItem(), makeItem()], "70x40", config);
    expect((zpl.match(/\^PR2,2,2\n~SD25\n\^MTD/g) ?? []).length).toBe(2);
  });
});

describe("custom ZPL sizes", () => {
  it("sizes a 70×50 label to 560×400 dots", async () => {
    const zpl = await generateZplLabels([makeItem()], "70x50", {
      ...DEFAULT_LABEL_CONFIG,
      dimension: { width: 70, height: 50 },
    });
    expect(zpl).toContain("^PW560");
    expect(zpl).toContain("^LL400");
  });

  it("rejects sizes the printer cannot take", async () => {
    await expect(generateZplLabels([makeItem()], "120x50", DEFAULT_LABEL_CONFIG)).rejects.toThrow(
      "Unsupported ZPL label size"
    );
  });
});
