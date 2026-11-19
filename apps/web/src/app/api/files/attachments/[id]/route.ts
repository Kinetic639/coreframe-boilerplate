import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// A stable address for an attachment's file, e.g. a card cover:
// /api/files/attachments/<id>. It checks access as the signed-in user (the
// attachment row and the storage object are both under RLS) and redirects to
// a short-lived signed link. The redirect is cached privately by the browser,
// so a board refetch keeps the same image address and the image does not
// reload or flicker. An attachment's file never changes under its id.

export const dynamic = "force-dynamic";

const BUCKET = "app-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Shorter than the signed link's life, so a cached redirect never points at an expired link. */
const BROWSER_CACHE_SECONDS = 50 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("app_attachments")
    .select("storage_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const storagePath = (row as { storage_path?: string } | null)?.storage_path;
  if (!storagePath) return notFound();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return notFound();

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${BROWSER_CACHE_SECONDS}` },
  });
}
