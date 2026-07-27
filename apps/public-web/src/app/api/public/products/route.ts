import { NextResponse } from "next/server";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";
import { productSearchQuerySchema } from "@/lib/public-marketplace/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams.entries());
  const parsed = productSearchQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Invalid product search query" },
      { status: 400 }
    );
  }

  const result = await PublicMarketplaceRepository.searchProducts(parsed.data);
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
