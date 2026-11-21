/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { decodeGfaData, isDotBlack, parseZplLabels } from "../zpl-preview";
import { generateZplLabels } from "../zpl";
import { DEFAULT_LABEL_CONFIG } from "../label-config";

describe("decodeGfaData", () => {
  it("reads plain hex", () => {
    expect(Array.from(decodeGfaData("FF00\n80 01", 4, 2))).toEqual([0xff, 0x00, 0x80, 0x01]);
  });

  it("reads ZPL ASCII compression", () => {
    // 2 bytes per row = 4 nibbles. "IF" = FFF + ",": row 1; "!" = row of F; ":" repeats it.
    expect(Array.from(decodeGfaData("IF,!:", 6, 2))).toEqual([0xff, 0xf0, 0xff, 0xff, 0xff, 0xff]);
    // "g0" = 20 zero nibbles.
    expect(Array.from(decodeGfaData("g0", 10, 10))).toEqual(new Array(10).fill(0));
  });
});

describe("parseZplLabels", () => {
  it("reads size, position and graphics of each label", () => {
    const zpl =
      "^XA^PW16^LL2^FO8,0^GFA,2,2,1,80C0^FS^XZ\n^XA^PW8^LL1^FO0,0^GFA,1,1,1,01^FS^FDx^FS^XZ";
    const [first, second] = parseZplLabels(zpl);
    expect(first).toMatchObject({ width: 16, height: 2, skipped: 0 });
    expect(first.graphics[0]).toMatchObject({ x: 8, y: 0, width: 8, height: 2 });
    expect(isDotBlack(first.graphics[0], 0, 0)).toBe(true);
    expect(isDotBlack(first.graphics[0], 1, 0)).toBe(false);
    expect(isDotBlack(first.graphics[0], 1, 1)).toBe(true);
    expect(second.skipped).toBe(1);
    expect(isDotBlack(second.graphics[0], 7, 0)).toBe(true);
  });

  it("reads the app's own 70×40 labels back", async () => {
    const zpl = await generateZplLabels(
      [{ token: "AbCdEfGhIjKlMnOpQrSt12", fields: { primary: "A-01" } }],
      "70x40",
      DEFAULT_LABEL_CONFIG
    );
    const [label] = parseZplLabels(zpl);
    expect(label).toMatchObject({ width: 560, height: 320, skipped: 0 });
    expect(label.graphics[0]).toMatchObject({ width: 560, height: 320 });
    expect(label.graphics[0].data.some((byte) => byte !== 0)).toBe(true);
  });
});
