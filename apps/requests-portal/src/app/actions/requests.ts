"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import {
  createRequestSchema,
  LIMITS,
  orderNumberSchema,
  warehouseSchema,
} from "@/lib/validation/requests";
import { requirePortalContext } from "@/server/portal-context";
import { uploadAttachment } from "@/server/requests/attachments.service";
import {
  closeOwnRequest,
  createRequest,
  lookupOrder,
  type OrderLookup,
} from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

export type ActionState = { error?: string; fieldErrors?: Record<string, string> } | null;

function filesFrom(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, LIMITS.maxFiles);
}

export async function createRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requirePortalContext();
  const parsed = createRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }
  const v = parsed.data;
  if (!ctx.branches.some((b) => b.id === v.branchId) || !ctx.can.create(v.branchId)) {
    return { error: "forbidden" };
  }

  const supabase = await createClient();
  const created = await createRequest(supabase, ctx, {
    branchId: v.branchId,
    typeId: v.typeId,
    title: v.title,
    description: v.description || null,
    orderNumber: v.orderNumber || null,
    warehouse: v.warehouse || null,
  });
  if (!created.ok) return { error: created.error };

  for (const file of filesFrom(formData)) {
    const up = await uploadAttachment(supabase, ctx, created.data.id, file);
    if (!up.ok) console.error("[createRequestAction] attachment failed:", up.error);
  }

  revalidatePath("/", "layout");
  redirect({
    href: { pathname: "/[ticketId]", params: { ticketId: created.data.id } },
    locale: await getLocale(),
  });
  return null;
}

export async function lookupOrderAction(nr: string, mag: string): Promise<OrderLookup | null> {
  const n = orderNumberSchema.safeParse(nr);
  const m = warehouseSchema.safeParse(mag);
  if (!n.success || !m.success) return null;
  const ctx = await requirePortalContext();
  return lookupOrder(await createClient(), ctx, n.data, m.data);
}

export async function closeRequestAction(
  ticketId: string,
  outcome: "closed" | "cancelled"
): Promise<ActionState> {
  const id = z.string().uuid().safeParse(ticketId);
  if (!id.success || (outcome !== "closed" && outcome !== "cancelled")) return { error: "invalid" };
  const ctx = await requirePortalContext();
  const res = await closeOwnRequest(await createClient(), ctx, id.data, outcome);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return null;
}
