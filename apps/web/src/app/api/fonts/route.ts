import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED = new Set(["Roboto-Regular.ttf", "Roboto-Bold.ttf"]);

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name || !ALLOWED.has(name)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filePath = path.join(process.cwd(), "public", "fonts", name);
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
}
