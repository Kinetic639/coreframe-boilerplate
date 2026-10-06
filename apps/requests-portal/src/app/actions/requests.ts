"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requirePortalContext } from "@/server/portal-context";
import { uploadAttachment } from "@/server/requests/attachments.service";
import { addComment } from "@/server/requests/comments.service";
import {
  closeOwnRequest,
  createRequest,
  lookupOrder,
  type OrderLookup,
} from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

export type ActionState = { error?: string; fieldErrors?: Record<string, string> } | null;

const orderNumber = z
  .string()
  .trim()
  .regex(/^\d{3,8}$/, "orderNumber");
const warehouse = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "warehouse");

const createSchema = z
  .object({
    branchId: z.string().uuid(),
    typeId: z.string().uuid("type"),
    title: z.string().trim().min(3, "title").max(200, "title"),
    description: z.string().trim().max(5000).optional(),
    orderNumber: orderNumber.optional().or(z.literal("")),
    warehouse: warehouse.optional().or(z.literal("")),
  })
  .refine((v) => !v.orderNumber || !!v.warehouse, { path: ["warehouse"], message: "warehouse" })
  .refine((v) => !v.warehouse || !!v.orderNumber, {
    path: ["orderNumber"],
    message: "orderNumber",
  });

function filesFrom(formData: FormData): File[] {
  return formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
}

export async function createRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requirePortalContext();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
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

  for (const file of filesFrom(formData).slice(0, 10)) {
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
  const n = orderNumber.safeParse(nr);
  const m = warehouse.safeParse(mag);
  if (!n.success || !m.success) return null;
  const ctx = await requirePortalContext();
  return lookupOrder(await createClient(), ctx, n.data, m.data);
}

const commentSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().max(5000),
});

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requirePortalContext();
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  const files = filesFrom(formData).slice(0, 10);
  if (!parsed.success || (!parsed.data.body && files.length === 0)) return { error: "empty" };

  const supabase = await createClient();
  const { ticketId, body } = parsed.data;
  if (body) {
    const res = await addComment(supabase, ctx, ticketId, body);
    if (!res.ok) return { error: res.error };
  }
  for (const file of files) {
    const up = await uploadAttachment(supabase, ctx, ticketId, file);
    if (!up.ok) return { error: `attachment:${up.error}` };
  }
  revalidatePath("/", "layout");
  return null;
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
