import { NextResponse } from "next/server";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

export async function GET() {
  const result = await PublicMarketplaceRepository.getMarketplaceSnapshot();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
