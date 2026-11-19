"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadAppContextV2 } from "@/server/loaders/v2/load-app-context.v2";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
import {
  ListSavedViewsService,
  type ListSavedView,
} from "@/server/services/list-saved-views.service";
import { ORG_UPDATE } from "@/lib/constants/permissions";
import { checkPermission } from "@/lib/utils/permissions";
import { getAuthUser } from "@/server/auth/get-auth-user";

// The saved views of any data table list. Every member of the organization
// may keep views of their own and share them; RLS enforces the rest.

type Result<T> = { success: true; data: T } | { success: false; error: string };

const listKey = z
  .string()
  .min(1)
  .max(200)
  .regex(/^\/[A-Za-z0-9/_[\]-]*$/);

const listSchema = z.object({ listKey });
const saveSchema = z.object({
  listKey,
  name: z.string().trim().min(1).max(160),
  query: z.string().max(4000),
  isShared: z.boolean().optional().default(false),
});
const removeSchema = z.object({ id: z.string().uuid() });

type Auth =
  | { success: false; error: string }
  | {
      success: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      orgId: string;
    };

async function context(): Promise<Auth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { success: false, error: "Not authenticated" };
  const app = await loadAppContextV2();
  if (!app?.activeOrgId) return { success: false, error: "No active organization" };
  return { success: true, supabase, userId: user.id, orgId: app.activeOrgId };
}

export interface ListSavedViews {
  views: ListSavedView[];
  userId: string;
  /** May remove views others shared (org.update). */
  canManageShared: boolean;
}

/** A list's views (one's own and the shared ones) and what the person may do with them. */
export async function listSavedViewsAction(rawInput: unknown): Promise<Result<ListSavedViews>> {
  const parsed = listSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  const auth = await context();
  if (auth.success === false) return { success: false, error: auth.error };
  const [views, snapshot] = await Promise.all([
    ListSavedViewsService.list(auth.supabase, auth.orgId, parsed.data.listKey),
    PermissionServiceV2.getPermissionSnapshotForUser(auth.supabase, auth.userId, auth.orgId),
  ]);
  if (views.success === false) return { success: false, error: views.error };
  return {
    success: true,
    data: {
      views: views.data,
      userId: auth.userId,
      canManageShared: checkPermission(snapshot, ORG_UPDATE),
    },
  };
}

/** Saves the list's current address under a name. */
export async function saveListViewAction(rawInput: unknown): Promise<Result<ListSavedView>> {
  const parsed = saveSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  const auth = await context();
  if (auth.success === false) return { success: false, error: auth.error };
  return ListSavedViewsService.save(auth.supabase, auth.orgId, auth.userId, {
    listKey: parsed.data.listKey!,
    name: parsed.data.name!,
    query: parsed.data.query!,
    isShared: parsed.data.isShared ?? false,
  });
}

/** Removes a view (one's own, or a shared one with org.update). */
export async function deleteListViewAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const parsed = removeSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  const auth = await context();
  if (auth.success === false) return { success: false, error: auth.error };
  return ListSavedViewsService.remove(auth.supabase, auth.orgId, parsed.data.id);
}
