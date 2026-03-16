"use server";

import { createClient } from "@/utils/supabase/server";
import { eventService } from "@/server/services/event.service";

export type SubscriptionPlan = {
  id: string;
  name: string;
  display_name: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  max_branches: number;
  max_members: number;
  max_storage_mb: number;
  enabled_modules: string[];
};

export type CreateOrganizationResult =
  | { success: true; organizationId: string; alreadyExisted?: boolean }
  | { success: false; error: string };

export async function getAvailablePlansAction(): Promise<SubscriptionPlan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, name, price_monthly, price_yearly, limits, enabled_modules")
    .eq("is_active", true)
    .order("price_monthly", { ascending: true });

  if (error || !data) return [];

  return data.map((p) => {
    const limits = (p.limits ?? {}) as Record<string, number>;
    const monthly = parseFloat((p.price_monthly as unknown as string) ?? "0");
    const yearly = parseFloat((p.price_yearly as unknown as string) ?? "0");
    return {
      id: p.id,
      name: p.name,
      display_name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
      price_monthly_cents: Math.round(monthly * 100),
      price_yearly_cents: Math.round(yearly * 100),
      max_branches: limits["warehouse.max_branches"] ?? -1,
      max_members: limits["organization.max_users"] ?? -1,
      max_storage_mb: -1,
      enabled_modules: Array.isArray(p.enabled_modules) ? p.enabled_modules : [],
    };
  });
}

export async function checkOrgSlugAction(slug: string): Promise<{ available: boolean }> {
  if (!slug || slug.length < 2 || !/^[a-z0-9-]+$/.test(slug)) return { available: false };

  const supabase = await createClient();
  // Uses SECURITY DEFINER function to bypass RLS (user has no org during onboarding)
  const { data, error } = await supabase.rpc("check_org_slug_available", { p_slug: slug });
  if (error) return { available: false };
  return { available: data === true };
}

export async function createOrganizationAction(
  orgName: string,
  branchName: string,
  planId: string | null,
  orgName2?: string | null,
  orgSlug?: string | null
): Promise<CreateOrganizationResult> {
  const supabase = await createClient();

  // Get the current user for event actor attribution
  const {
    data: { user: onboardingUser },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("create_organization_for_current_user", {
    p_name: orgName.trim(),
    p_branch_name: branchName.trim(),
    p_plan_id: planId ?? null,
    p_name_2: orgName2?.trim() || null,
    p_slug: orgSlug?.trim() || null,
  });

  if (error) {
    console.error("[createOrganizationAction]", error.message);
    return { success: false, error: error.message };
  }

  const result = data as {
    success: boolean;
    organization_id?: string;
    already_existed?: boolean;
    error?: string;
  };

  if (!result.success) {
    return { success: false, error: result.error ?? "Unknown error" };
  }

  const organizationId = result.organization_id!;

  // Actor model invariant: actorType "user" requires a non-null actorUserId.
  // Skip both onboarding events if the user session is unavailable rather than
  // emitting actorType="user" with actorUserId=null.
  if (!onboardingUser?.id) {
    console.warn(
      "[createOrganizationAction] Skipping onboarding event emission: missing actor user id",
      {
        organizationId,
      }
    );
  } else {
    // Generate one requestId so both events are correlated to this onboarding workflow
    const requestId = crypto.randomUUID();

    const orgCreatedResult = await eventService.emit({
      actionKey: "org.created",
      actorType: "user",
      actorUserId: onboardingUser.id,
      organizationId,
      entityType: "organization",
      entityId: organizationId,
      metadata: {
        org_name: orgName.trim(),
        org_slug: orgSlug?.trim() || undefined,
      },
      eventTier: "baseline",
      requestId,
    });
    if (!orgCreatedResult.success) {
      console.error("[createOrganizationAction] Failed to emit org.created:", {
        actionKey: "org.created",
        organizationId,
        actorUserId: onboardingUser.id,
        entityType: "organization",
        entityId: organizationId,
        requestId,
        error: (orgCreatedResult as { success: false; error: string }).error,
      });
    }

    const onboardingCompletedResult = await eventService.emit({
      actionKey: "org.onboarding.completed",
      actorType: "user",
      actorUserId: onboardingUser.id,
      organizationId,
      entityType: "organization",
      entityId: organizationId,
      metadata: { org_name: orgName.trim() },
      eventTier: "baseline",
      requestId,
    });
    if (!onboardingCompletedResult.success) {
      console.error("[createOrganizationAction] Failed to emit org.onboarding.completed:", {
        actionKey: "org.onboarding.completed",
        organizationId,
        actorUserId: onboardingUser.id,
        entityType: "organization",
        entityId: organizationId,
        requestId,
        error: (onboardingCompletedResult as { success: false; error: string }).error,
      });
    }
  }

  return {
    success: true,
    organizationId,
    alreadyExisted: result.already_existed ?? false,
  };
}
