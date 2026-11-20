import { describe, expect, it } from "vitest";
import { imageVariantPath, imageVariantUrl } from "../image-variant-paths";

describe("imageVariantPath", () => {
  it("puts the small version next to the file under a fixed name", () => {
    expect(imageVariantPath("org/p/product/abc.webp", "thumb")).toBe(
      "org/p/product/abc.thumb.webp"
    );
    expect(imageVariantPath("f1/abc.png", "card", "image/jpeg")).toBe("f1/abc.card.jpg");
  });
});

describe("imageVariantUrl", () => {
  it("swaps the extension of a public URL", () => {
    expect(
      imageVariantUrl("https://x.supabase.co/storage/v1/object/public/b/o/p/a.jpg", "thumb")
    ).toBe("https://x.supabase.co/storage/v1/object/public/b/o/p/a.thumb.webp");
  });

  it("keeps the query string", () => {
    expect(imageVariantUrl("https://h/a.png?v=1", "card")).toBe("https://h/a.card.webp?v=1");
  });

  it("returns null for URLs without an extension or already a small version", () => {
    expect(imageVariantUrl("blob:https://h/1234", "thumb")).toBeNull();
    expect(imageVariantUrl("https://h/a.thumb.webp", "card")).toBeNull();
  });
});
