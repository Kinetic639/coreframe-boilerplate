import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED = new Set(["Roboto-Regular.ttf", "Roboto-Bold.ttf"]);

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name || !ALLOWED.has(name)) {
    // Never let a CDN/edge cache a negative response for a valid-looking
    // request — a stale deploy that 404s once must not poison the cache
    // for every request after the file becomes available.
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const filePath = path.join(process.cwd(), "public", "fonts", name);
  try {
    const buffer = await readFile(filePath);
    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "font/truetype",
        "Cache-Control": "public, max-age=31536000, immutable",
        // Explicitly prevent any proxy/CDN from re-encoding the binary
        "Content-Encoding": "identity",
      },
    });
  } catch (error) {
    console.error(`[api/fonts] Failed to read ${filePath}:`, error);
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
