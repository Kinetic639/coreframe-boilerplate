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
