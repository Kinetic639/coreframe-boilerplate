// Loads src/lib/media/image-compress.ts as a plain browser script, so the
// backfill makes the same small versions as the app does on upload.
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../../src/lib/media/image-compress.ts", import.meta.url));

export function imageCompressBrowserScript() {
  const js = stripTypeScriptTypes(readFileSync(SOURCE, "utf8"));
  if (/^\s*import\s/m.test(js)) throw new Error("image-compress.ts must not import other modules");
  const body = js.replace(/^"use client";\s*/m, "").replace(/^export /gm, "");
  return `(() => {\n${body}\nwindow.ImageCompress = { prepareImage };\n})();`;
}

/**
 * Makes the small versions of an image in the page (which must have loaded
 * imageCompressBrowserScript), leaving the stored file as it is. Returns null
 * when the browser cannot read the file.
 */
export async function makeVariantsInPage(page, bytes, type, variantNames) {
  return page.evaluate(
    async ({ base64, type, variantNames }) => {
      const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const prepared = await window.ImageCompress.prepareImage(
        new File([data], "image", { type }),
        { keepOriginal: true, variants: variantNames }
      );
      if (!prepared) return null;
      const variants = [];
      for (const variant of prepared.variants) {
        const out = new Uint8Array(await variant.blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < out.length; i += 0x8000)
          binary += String.fromCharCode(...out.subarray(i, i + 0x8000));
        variants.push({
          name: variant.name,
          width: variant.width,
          height: variant.height,
          type: variant.blob.type,
          base64: btoa(binary),
        });
      }
      return { width: prepared.width, height: prepared.height, variants };
    },
    { base64: Buffer.from(bytes).toString("base64"), type, variantNames }
  );
}
