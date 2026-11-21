import { describe, it, expect } from "vitest";
import { computeLabelLayout, FOOTER_HEIGHT_MM, labelPaddingMm } from "../label-layout";
import { DEFAULT_LABEL_CONFIG, type LabelConfig } from "../label-config";

const landscape: LabelConfig = { ...DEFAULT_LABEL_CONFIG, dimension: { width: 70, height: 40 } };
const portrait: LabelConfig = {
  ...landscape,
  orientation: "portrait",
  textPosition: "below",
  dimension: { width: 40, height: 70 },
};
const input = (width: number, height: number) => ({
  width,
  height,
  textHeight: 6,
  hasText: true,
  watermark: false,
});

describe("computeLabelLayout", () => {
  it("puts the footer at the bottom of the text column in landscape", () => {
    const layout = computeLabelLayout(landscape, input(70, 40));
    const pad = labelPaddingMm(landscape);
    expect(layout.footer).toMatchObject({
      x: layout.text!.x,
      w: layout.text!.w,
      h: FOOTER_HEIGHT_MM.small,
    });
    expect(layout.footer!.y + layout.footer!.h).toBeCloseTo(40 - pad);
    expect(layout.text!.y + layout.text!.h).toBeLessThan(layout.footer!.y);
    expect(layout.footer!.x).toBeGreaterThan(layout.qr.x + layout.qr.size);
  });

  it("puts the footer at the bottom of a portrait label across its width, even with text above", () => {
    for (const textPosition of ["below", "above"] as const) {
      const layout = computeLabelLayout({ ...portrait, textPosition }, input(40, 70));
      const pad = labelPaddingMm(portrait);
      expect(layout.footer).toMatchObject({ x: pad, w: 40 - pad * 2 });
      expect(layout.footer!.y + layout.footer!.h).toBeCloseTo(70 - pad);
      expect(layout.qr.y + layout.qr.size).toBeLessThanOrEqual(layout.footer!.y);
      expect(layout.text!.y + layout.text!.h).toBeLessThanOrEqual(layout.footer!.y);
    }
  });

  it("reserves a bigger strip for a bigger footer", () => {
    const small = computeLabelLayout(landscape, input(70, 40));
    const large = computeLabelLayout(
      { ...landscape, footer: { show: true, size: "large" } },
      input(70, 40)
    );
    expect(large.footer!.h).toBe(FOOTER_HEIGHT_MM.large);
    expect(large.text!.h).toBeLessThan(small.text!.h);
  });

  it("aligns a smaller QR across a portrait label", () => {
    const config = { ...portrait, qrHeightRatio: 0.5 };
    const pad = labelPaddingMm(config);
    const at = (qrAlign: LabelConfig["qrAlign"]) =>
      computeLabelLayout({ ...config, qrAlign }, input(40, 70)).qr;
    expect(at("start").x).toBeCloseTo(pad);
    expect(at(undefined).x).toBeCloseTo((40 - at(undefined).size) / 2);
    expect(at("end").x + at("end").size).toBeCloseTo(40 - pad);
  });

  it("aligns a smaller QR up and down in landscape", () => {
    const config = { ...landscape, qrHeightRatio: 0.5 };
    const pad = labelPaddingMm(config);
    const top = computeLabelLayout({ ...config, qrAlign: "start" }, input(70, 40)).qr;
    const bottom = computeLabelLayout({ ...config, qrAlign: "end" }, input(70, 40)).qr;
    expect(top.y).toBeCloseTo(pad);
    expect(bottom.y + bottom.size).toBeCloseTo(40 - pad);
  });

  it("has no text area or footer without text", () => {
    const layout = computeLabelLayout(landscape, { ...input(70, 40), hasText: false });
    expect(layout.text).toBeNull();
    expect(layout.footer).toBeNull();
  });
});
