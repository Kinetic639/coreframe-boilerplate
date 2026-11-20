// Makes the 160 px and 640 px versions (thumb, card) for image attachments
// uploaded before they were made on upload, stores them next to the file in
// app-attachments and records them in app_attachments.metadata.variants.
//
// Run from apps/web:
//   node scripts/image-backfill/backfill.mjs          (dry run: makes the versions, writes nothing)
//   node scripts/image-backfill/backfill.mjs --apply  (uploads them and updates the rows)
//
// Needs Chromium for Playwright (npx playwright install chromium) and, in the
// environment or .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// (SHARED__SUPABASE_TARGET_URL / SHARED__SUPABASE_TARGET_SERVICE_ROLE_KEY also work).
import { chromium } from "@playwright/test";
import { imageCompressBrowserScript } from "./browser-module.mjs";
import { supabaseAdmin } from "./env.mjs";

const APPLY = process.argv.includes("--apply");
const BUCKET = "app-attachments";
const stem = (path) => path.replace(/\.[a-zA-Z0-9]{1,12}$/, "");
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const supabase = supabaseAdmin();

const { data: rows, error } = await supabase
  .from("app_attachments")
  .select("id, storage_path, content_type, size_bytes, metadata")
  .is("deleted_at", null)
  .like("content_type", "image/%");
if (error) throw error;

const todo = rows.filter((row) => !row.metadata?.variants?.thumb);
console.log(
  `${rows.length} images, ${todo.length} without small versions${APPLY ? "" : " (dry run)"}`
);

// CHROMIUM_PATH: use an installed Chromium instead of the one Playwright downloads.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.addScriptTag({ content: imageCompressBrowserScript() });

let made = 0;
let failed = 0;
for (const row of todo) {
  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(row.storage_path);
  if (downloadError) {
    console.log(`SKIP ${row.id}: ${downloadError.message}`);
    failed++;
    continue;
  }

  const result = await page.evaluate(
    async ({ base64, type }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const prepared = await window.ImageCompress.prepareImage(
        new File([bytes], "image", { type }),
        {
          keepOriginal: true,
        }
      );
      if (!prepared) return null;
      const variants = [];
      for (const variant of prepared.variants) {
        const data = new Uint8Array(await variant.blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < data.length; i += 0x8000)
          binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
        variants.push({
          ...variant,
          blob: undefined,
          type: variant.blob.type,
          base64: btoa(binary),
        });
      }
      return { width: prepared.width, height: prepared.height, variants };
    },
    { base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), type: row.content_type }
  );
  if (!result) {
    console.log(`SKIP ${row.id}: the browser could not read this ${row.content_type}`);
    failed++;
    continue;
  }

  const variants = {};
  for (const variant of result.variants) {
    const path = `${stem(row.storage_path)}.${variant.name}.${variant.type === "image/jpeg" ? "jpg" : "webp"}`;
    const bytes = Buffer.from(variant.base64, "base64");
    if (APPLY) {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: variant.type,
        upsert: true,
        cacheControl: "31536000",
      });
      if (uploadError) {
        console.log(`FAIL ${path}: ${uploadError.message}`);
        continue;
      }
    }
    variants[variant.name] = {
      path,
      width: variant.width,
      height: variant.height,
      size: bytes.length,
      content_type: variant.type,
    };
  }

  if (APPLY) {
    const metadata = {
      ...(row.metadata ?? {}),
      width: result.width,
      height: result.height,
      variants,
    };
    const { error: updateError } = await supabase
      .from("app_attachments")
      .update({ metadata })
      .eq("id", row.id);
    if (updateError) {
      console.log(`FAIL ${row.id}: ${updateError.message}`);
      failed++;
      continue;
    }
  }
  made++;
  console.log(
    `${row.id} ${kb(row.size_bytes)} ${result.width}x${result.height} -> ` +
      Object.entries(variants)
        .map(([name, v]) => `${name} ${v.width}x${v.height} ${kb(v.size)}`)
        .join(", ")
  );
}

await browser.close();
console.log(`${APPLY ? "Done" : "Dry run done"}: ${made} images, ${failed} skipped or failed.`);
