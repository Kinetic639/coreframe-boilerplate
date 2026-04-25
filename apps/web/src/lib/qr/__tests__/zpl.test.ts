/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { generateZplLabels } from "../zpl";
import type { ZplLabelItem } from "../zpl";

const TOKEN = "AbCdEfGhIjKlMnOpQrSt12";

function makeItem(overrides: Partial<ZplLabelItem> = {}): ZplLabelItem {
  return { token: TOKEN, label: "Rack A1", includeTokenPreview: false, ...overrides };
}

describe("generateZplLabels", () => {
  it("throws for empty item list", () => {
    expect(() => generateZplLabels([], "50x30")).toThrow("no labels");
  });

  it("returns a string", () => {
    expect(typeof generateZplLabels([makeItem()], "50x30")).toBe("string");
  });

  it("contains ^XA and ^XZ markers for each label", () => {
    const zpl = generateZplLabels([makeItem(), makeItem()], "50x30");
    const starts = (zpl.match(/\^XA/g) ?? []).length;
    const ends = (zpl.match(/\^XZ/g) ?? []).length;
    expect(starts).toBe(2);
    expect(ends).toBe(2);
  });

  it("encodes the token in a ^BQ command", () => {
    const zpl = generateZplLabels([makeItem()], "50x30");
    expect(zpl).toContain("^BQN,2,");
    expect(zpl).toContain(TOKEN);
  });

  it("sets HA (error correction High, auto mask) prefix", () => {
    const zpl = generateZplLabels([makeItem()], "50x30");
    expect(zpl).toContain(`HA,${TOKEN}`);
  });

  it("includes ^PW (print width) for each label", () => {
    const zpl = generateZplLabels([makeItem()], "50x30");
    expect(zpl).toContain("^PW");
  });

  it("50x30 uses magnification 4", () => {
    const zpl = generateZplLabels([makeItem()], "50x30");
    expect(zpl).toContain("^BQN,2,4");
  });

  it("70x40 uses magnification 5", () => {
    const zpl = generateZplLabels([makeItem()], "70x40");
    expect(zpl).toContain("^BQN,2,5");
  });

  it("includes label text when label is set", () => {
    const zpl = generateZplLabels([makeItem({ label: "MyRack" })], "50x30");
    expect(zpl).toContain("MyRack");
  });

  it("includes token preview when includeTokenPreview is true", () => {
    const zpl = generateZplLabels([makeItem({ includeTokenPreview: true })], "70x40");
    expect(zpl).toContain(TOKEN.slice(0, 8));
  });

  it("handles 50 labels without error", () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      makeItem({ token: `token${String(i).padStart(20, "0")}` })
    );
    const zpl = generateZplLabels(items, "70x40");
    const count = (zpl.match(/\^XA/g) ?? []).length;
    expect(count).toBe(50);
  });
});
