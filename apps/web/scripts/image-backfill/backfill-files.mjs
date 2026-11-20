// Makes the small versions for product images and feedback screenshots
// uploaded before they were made on upload. They are stored next to the file
// under a fixed name, which the app looks for (no database change):
//   inventory-item-images: "<uuid>.thumb.webp" (160 px) and "<uuid>.card.webp" (640 px)
//   platform-feedback:     "<uuid>.card.webp" (640 px, the preview in a report)
// Files that already have them are skipped, so the script can be run again.
//
// Run from apps/web:
//   node scripts/image-backfill/backfill-files.mjs          (dry run: makes the versions, writes nothing)
//   node scripts/image-backfill/backfill-files.mjs --apply  (uploads them)
//
// Same requirements as backfill.mjs (Chromium for Playwright, or CHROMIUM_PATH,
// and the Supabase URL and service role key in the environment or .env.local).
import { chromium } from "@playwright/test";
import { imageCompressBrowserScript, makeVariantsInPage } from "./browser-module.mjs";
import { supabaseAdmin } from "./env.mjs";

const APPLY = process.argv.includes("--apply");
const stem = (path) => path.replace(/\.[a-zA-Z0-9]{1,12}$/, "");
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const VARIANT_FILE = /\.(thumb|card)\.(webp|jpg)$/;

const supabase = supabaseAdmin();

async function rowsOf(table, select, filter) {
  const { data, error } = await filter(supabase.from(table).select(select));
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

const products = await rowsOf(
  "inventory_item_images",
  "storage_bucket, storage_path, content_type",
  (query) => query.is("deleted_at", null)
);
const feedback = await rowsOf(
  "platform_feedback_attachments",
  "storage_path, content_type",
  (query) => query.like("content_type", "image/%")
);

const sources = [
  ...products.map((row) => ({
    bucket: row.storage_bucket || "inventory-item-images",
    path: row.storage_path,
    type: row.content_type,
    variants: ["thumb", "card"],
  })),
  ...feedback.map((row) => ({
    bucket: "platform-feedback",
    path: row.storage_path,
    type: row.content_type,
    variants: ["card"],
  })),
].filter((file) => file.path && !VARIANT_FILE.test(file.path));

// Names already stored in each folder, to skip files that have their versions.
const listed = new Map();
async function namesIn(bucket, dir) {
  const key = `${bucket}/${dir}`;
  if (!listed.has(key)) {
    const names = new Set();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(dir, { limit: 1000, offset });
      if (error) throw new Error(`${key}: ${error.message}`);
      for (const item of data) names.add(item.name);
      if (data.length < 1000) break;
    }
    listed.set(key, names);
  }
  return listed.get(key);
}

const todo = [];
for (const file of sources) {
  const dir = file.path.split("/").slice(0, -1).join("/");
  const names = await namesIn(file.bucket, dir);
  const base = stem(file.path.split("/").pop());
  const missing = file.variants.filter(
    (name) => !names.has(`${base}.${name}.webp`) && !names.has(`${base}.${name}.jpg`)
  );
  if (missing.length > 0) todo.push({ ...file, variants: missing });
}

console.log(
  `${products.length} product images, ${feedback.length} feedback images; ` +
    `${todo.length} need small versions${APPLY ? "" : " (dry run)"}`
);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.addScriptTag({ content: imageCompressBrowserScript() });

let made = 0;
let failed = 0;
for (const file of todo) {
  const label = `${file.bucket}/${file.path}`;
  const { data: blob, error: downloadError } = await supabase.storage
    .from(file.bucket)
    .download(file.path);
  if (downloadError) {
    console.log(`SKIP ${label}: ${downloadError.message}`);
    failed++;
    continue;
  }
  const original = Buffer.from(await blob.arrayBuffer());
  const result = await makeVariantsInPage(page, original, file.type || blob.type, file.variants);
  if (!result) {
    console.log(`SKIP ${label}: the browser could not read this ${file.type}`);
    failed++;
    continue;
  }
  if (result.variants.length === 0) {
    // Already small (a card version of a photo no larger than the card adds nothing).
    console.log(`${label} ${kb(original.length)} ${result.width}x${result.height}: small enough`);
    continue;
  }

  const done = [];
  for (const variant of result.variants) {
    const path = `${stem(file.path)}.${variant.name}.${variant.type === "image/jpeg" ? "jpg" : "webp"}`;
    const bytes = Buffer.from(variant.base64, "base64");
    if (APPLY) {
      const { error: uploadError } = await supabase.storage.from(file.bucket).upload(path, bytes, {
        contentType: variant.type,
        upsert: true,
        cacheControl: "31536000",
      });
      if (uploadError) {
        console.log(`FAIL ${file.bucket}/${path}: ${uploadError.message}`);
        failed++;
        continue;
      }
    }
    done.push(`${variant.name} ${variant.width}x${variant.height} ${kb(bytes.length)}`);
  }
  made++;
  console.log(
    `${label} ${kb(original.length)} ${result.width}x${result.height} -> ${done.join(", ")}`
  );
}

await browser.close();
console.log(`${APPLY ? "Done" : "Dry run done"}: ${made} images, ${failed} skipped or failed.`);
