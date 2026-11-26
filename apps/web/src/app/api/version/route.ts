import { NextResponse } from "next/server";
import { BUILD_COMMIT, BUILD_VERSION } from "@/lib/app-version";

// Answers with the version of the deployment that serves the request: an open tab compares
// it with the version it was loaded with, and asks to reload when they differ.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: BUILD_VERSION, commit: BUILD_COMMIT },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
