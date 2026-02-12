"use server";

import { revalidatePath } from "next/cache";
import { EntitlementsAdminService } from "@/server/services/entitlements-admin.service";
import {
  planNameSchema,
  moduleSlugSchema,
  limitKeySchema,
  overrideValueSchema,
  ADMIN_PATH,
} from "./schemas";
import { enforceAdminAccess, logActionError, isAdminActionError } from "./actions.server";

// ---------------------------------------------------------------------------
// Result type (only type export — safe for client import)
// ---------------------------------------------------------------------------
export type ActionResult = { ok: true } | { ok: false; message: string };

// ---------------------------------------------------------------------------
// Actions (the ONLY runtime exports from this file)
// ---------------------------------------------------------------------------

export async function actionSwitchPlan(planName: string): Promise<ActionResult> {
  let orgId: string | undefined;
  try {
    const parsed = planNameSchema.safeParse(planName);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.errors[0].message };
    }

    const ctx = await enforceAdminAccess();
    orgId = ctx.orgId;
    await EntitlementsAdminService.switchPlan(ctx.supabase, ctx.orgId, parsed.data);
    revalidatePath(ADMIN_PATH, "page");
    return { ok: true };
  } catch (error) {
    logActionError("actionSwitchPlan", { orgId, planName }, error);
    return {
      ok: false,
      message: isAdminActionError(error) ? error.publicMessage : "Failed to switch plan",
    };
  }
}

export async function actionAddModuleAddon(moduleSlug: string): Promise<ActionResult> {
  let orgId: string | undefined;
  try {
    const parsed = moduleSlugSchema.safeParse(moduleSlug);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.errors[0].message };
    }

    const ctx = await enforceAdminAccess();
    orgId = ctx.orgId;
    await EntitlementsAdminService.addModuleAddon(ctx.supabase, ctx.orgId, parsed.data);
    revalidatePath(ADMIN_PATH, "page");
    return { ok: true };
  } catch (error) {
    logActionError("actionAddModuleAddon", { orgId, moduleSlug }, error);
    return {
      ok: false,
      message: isAdminActionError(error) ? error.publicMessage : "Failed to add module addon",
    };
  }
}

export async function actionRemoveModuleAddon(moduleSlug: string): Promise<ActionResult> {
  let orgId: string | undefined;
  try {
    const parsed = moduleSlugSchema.safeParse(moduleSlug);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.errors[0].message };
    }

    const ctx = await enforceAdminAccess();
    orgId = ctx.orgId;
    await EntitlementsAdminService.removeModuleAddon(ctx.supabase, ctx.orgId, parsed.data);
    revalidatePath(ADMIN_PATH, "page");
    return { ok: true };
  } catch (error) {
    logActionError("actionRemoveModuleAddon", { orgId, moduleSlug }, error);
    return {
      ok: false,
      message: isAdminActionError(error) ? error.publicMessage : "Failed to remove module addon",
    };
  }
}

export async function actionSetLimitOverride(
  limitKey: string,
  overrideValue: number | string
): Promise<ActionResult> {
  let orgId: string | undefined;
  try {
    const keyParsed = limitKeySchema.safeParse(limitKey);
    if (!keyParsed.success) {
      return { ok: false, message: "Invalid limit key" };
    }

    const valueParsed = overrideValueSchema.safeParse(overrideValue);
    if (!valueParsed.success) {
      return { ok: false, message: valueParsed.error.errors[0].message };
    }

    const ctx = await enforceAdminAccess();
    orgId = ctx.orgId;
    await EntitlementsAdminService.setLimitOverride(
      ctx.supabase,
      ctx.orgId,
      keyParsed.data,
      valueParsed.data
    );
    revalidatePath(ADMIN_PATH, "page");
    return { ok: true };
  } catch (error) {
    logActionError("actionSetLimitOverride", { orgId, limitKey, overrideValue }, error);
    return {
      ok: false,
      message: isAdminActionError(error) ? error.publicMessage : "Failed to set limit override",
    };
  }
}

export async function actionResetToFree(): Promise<ActionResult> {
  let orgId: string | undefined;
  try {
    const ctx = await enforceAdminAccess();
    orgId = ctx.orgId;
    await EntitlementsAdminService.resetToFree(ctx.supabase, ctx.orgId);
    revalidatePath(ADMIN_PATH, "page");
    return { ok: true };
  } catch (error) {
    logActionError("actionResetToFree", { orgId }, error);
    return {
      ok: false,
      message: isAdminActionError(error) ? error.publicMessage : "Failed to reset to free plan",
    };
  }
}
