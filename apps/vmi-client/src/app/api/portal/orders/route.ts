import { NextResponse } from "next/server";
import { z } from "zod";
import { hasDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

const createOrderSchema = z.object({
  locationId: z.string().trim().min(1),
  notes: z.string().trim().max(1000).optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().trim().min(1),
        requestedQty: z.coerce.number().int().positive(),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(request: Request) {
  if (!(await hasDemoSession())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = createOrderSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { success: false, error: "Invalid order payload", issues: payload.error.flatten() },
      { status: 400 },
    );
  }

  const result = await VmiPortalRepository.createOrder(payload.data);
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
