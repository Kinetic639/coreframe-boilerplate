import { describe, expect, it } from "vitest";
import { clampCrop, cropSourceRect, initialCrop, zoomCrop } from "../avatar-crop";

const portrait = { width: 1000, height: 2000 };
const landscape = { width: 2000, height: 1000 };
const V = 200;

describe("avatar crop geometry", () => {
  it("the image always covers the viewport: offsets are clamped", () => {
    // Portrait at zoom 1: 200 x 400 on screen, so it can move 100 px up or down, not sideways
    expect(clampCrop(portrait, V, { zoom: 1, x: 50, y: 500 })).toEqual({ zoom: 1, x: 0, y: 100 });
    expect(clampCrop(landscape, V, { zoom: 1, x: -999, y: 10 })).toEqual({
      zoom: 1,
      x: -100,
      y: 0,
    });
    expect(clampCrop(portrait, V, { zoom: 9, x: 0, y: 0 }).zoom).toBe(4);
  });

  it("a portrait photo starts above its middle (where the face is)", () => {
    const start = initialCrop(portrait, V);
    expect(start).toEqual({ zoom: 1, x: 0, y: 50 });
    // The visible square: full width, starting a quarter of the way down instead of half
    expect(cropSourceRect(portrait, V, start)).toEqual({ sx: 0, sy: 250, size: 1000 });
    expect(initialCrop(landscape, V)).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it("the source square follows the pan and shrinks with the zoom", () => {
    expect(cropSourceRect(landscape, V, { zoom: 1, x: 0, y: 0 })).toEqual({
      sx: 500,
      sy: 0,
      size: 1000,
    });
    // Image moved fully right: the left edge of the photo is visible
    expect(cropSourceRect(landscape, V, { zoom: 1, x: 100, y: 0 }).sx).toBe(0);
    expect(cropSourceRect(landscape, V, { zoom: 2, x: 0, y: 0 })).toEqual({
      sx: 750,
      sy: 250,
      size: 500,
    });
  });

  it("zooming keeps the centre of the view in place", () => {
    const before = cropSourceRect(portrait, V, { zoom: 1, x: 0, y: 60 });
    const zoomed = zoomCrop(portrait, V, { zoom: 1, x: 0, y: 60 }, 2);
    const after = cropSourceRect(portrait, V, zoomed);
    expect(after.sx + after.size / 2).toBeCloseTo(before.sx + before.size / 2);
    expect(after.sy + after.size / 2).toBeCloseTo(before.sy + before.size / 2);
    // Zooming out again never leaves a gap
    expect(zoomCrop(portrait, V, { zoom: 3, x: 0, y: 500 }, 1).y).toBe(100);
  });
});
