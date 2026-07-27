import { NextResponse } from "next/server";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await PublicMarketplaceRepository.getCatalogById(id);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
