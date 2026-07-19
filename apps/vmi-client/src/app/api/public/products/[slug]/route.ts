import { NextResponse } from "next/server";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const result = await PublicMarketplaceRepository.getProductBySlug(slug);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
