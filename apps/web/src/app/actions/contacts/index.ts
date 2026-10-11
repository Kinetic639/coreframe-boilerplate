"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { ContactsDirectoryService } from "@/server/services/contacts-directory.service";
import type { ContactDirectoryPage, ContactDirectoryRow } from "@/lib/contacts/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const listSchema = z.object({
  kind: z.enum(["all", "member", "external"]).optional(),
  search: z.string().max(80).nullish(),
  descending: z.boolean().optional(),
  page: z.number().int().min(1).max(10_000).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

/** Any signed-in member of the active organization; the database decides what they see */
async function getContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId;
  if (!context?.user.user?.id || !orgId) return null;
  return { supabase, orgId };
}

/**
 * Contacts directory: employees for every member of the organization, external
 * contacts for users with crm.contacts.read (RLS). Used by the Contacts page
 * and the contacts drawer in the header.
 */
export async function listContactsDirectoryAction(
  rawInput: unknown = {}
): Promise<ActionResult<ContactDirectoryPage>> {
  try {
    const parsed = listSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const ctx = await getContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    return ContactsDirectoryService.list(ctx.supabase, ctx.orgId, parsed.data);
  } catch (error) {
    console.error("[listContactsDirectoryAction]", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function getContactDirectoryRowAction(
  key: string
): Promise<ActionResult<ContactDirectoryRow | null>> {
  try {
    if (typeof key !== "string" || key.length > 80)
      return { success: false, error: "Invalid input" };
    const ctx = await getContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    return ContactsDirectoryService.getByKey(ctx.supabase, ctx.orgId, key);
  } catch (error) {
    console.error("[getContactDirectoryRowAction]", error);
    return { success: false, error: "Unexpected error" };
  }
}
