import { describe, expect, it } from "vitest";
import { fitWithin, variantStoragePath } from "../image-compress";

describe("fitWithin", () => {
  it("scales the longest edge down to the limit and keeps the aspect ratio", () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 160)).toEqual({ width: 120, height: 160 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(300, 200, 640)).toEqual({ width: 300, height: 200 });
  });
});

describe("variantStoragePath", () => {
  it("puts the small version next to the stored file", () => {
    expect(variantStoragePath("org/user/abc.webp", "thumb", "image/webp")).toBe(
      "org/user/abc.thumb.webp"
    );
    expect(variantStoragePath("org/user/abc.jpg", "card", "image/jpeg")).toBe(
      "org/user/abc.card.jpg"
    );
  });
});
