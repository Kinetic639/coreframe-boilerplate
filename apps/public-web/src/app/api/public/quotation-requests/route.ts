import { NextResponse } from "next/server";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";
import { quotationRequestInputSchema } from "@/lib/public-marketplace/schemas";
import type { QuotationRequestInputDto } from "@/lib/public-marketplace/types";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = quotationRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const result = await PublicMarketplaceRepository.submitQuotationRequest(
    parsed.data as QuotationRequestInputDto
  );
  return NextResponse.json(result, { status: result.success ? 201 : 404 });
}
