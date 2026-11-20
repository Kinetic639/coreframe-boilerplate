import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** Values from .env.local in the current directory, under what the environment already sets. */
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
}

/** Supabase client with the service role key: it bypasses row-level security. */
export function supabaseAdmin() {
  loadEnvLocal();
  const url = process.env.SHARED__SUPABASE_TARGET_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SHARED__SUPABASE_TARGET_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or put them in .env.local)."
    );
  }
  console.log(`Supabase project: ${new URL(url).hostname}`);
  return createClient(url, key, { auth: { persistSession: false } });
}
