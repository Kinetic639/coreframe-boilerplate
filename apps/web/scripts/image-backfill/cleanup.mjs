// Removes files in app-attachments that no live attachment uses: files with no
// app_attachments row (uploads that were never recorded) and files of deleted
// attachments. A file's .thumb/.card versions stay while the file itself is used.
//
// Run from apps/web:
//   node scripts/image-backfill/cleanup.mjs          (dry run: lists the files)
//   node scripts/image-backfill/cleanup.mjs --apply  (deletes them; this cannot be undone)
import { supabaseAdmin } from "./env.mjs";

const APPLY = process.argv.includes("--apply");
const BUCKET = "app-attachments";
const stem = (path) => path.replace(/\.[a-zA-Z0-9]{1,12}$/, "");

const supabase = supabaseAdmin();

async function listAll(prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have no id.
      if (entry.id === null) files.push(...(await listAll(path)));
      else files.push({ path, size: entry.metadata?.size ?? 0 });
    }
    if (data.length < 1000) return files;
  }
}

const files = await listAll();
const { data: rows, error } = await supabase
  .from("app_attachments")
  .select("storage_path, deleted_at");
if (error) throw error;
const used = new Set(rows.filter((row) => !row.deleted_at).map((row) => stem(row.storage_path)));

const unused = files.filter((file) => !used.has(stem(file.path).replace(/\.(thumb|card)$/, "")));
const bytes = unused.reduce((sum, file) => sum + file.size, 0);
console.log(`${files.length} files, ${unused.length} unused (${(bytes / 1048576).toFixed(1)} MB)`);
for (const file of unused) console.log(`  ${file.path}  ${(file.size / 1024).toFixed(0)} KB`);

if (!APPLY) {
  console.log("Dry run: nothing deleted. Add --apply to delete these files.");
} else if (unused.length > 0) {
  for (let i = 0; i < unused.length; i += 100) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(unused.slice(i, i + 100).map((file) => file.path));
    if (removeError) throw removeError;
  }
  console.log(`Deleted ${unused.length} files.`);
}
