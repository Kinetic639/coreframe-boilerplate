"use server";

import { createClient } from "@/utils/supabase/server";

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
    .select(
      "id, name, display_name, price_monthly_cents, price_yearly_cents, max_branches, max_members, max_storage_mb, enabled_modules"
    )
    .eq("is_active", true)
    .order("price_monthly_cents", { ascending: true });

  if (error || !data) return [];
  return data.map((p) => ({
    ...p,
    enabled_modules: Array.isArray(p.enabled_modules) ? p.enabled_modules : [],
  }));
}

export async function createOrganizationAction(
  orgName: string,
  branchName: string,
  planId: string | null
): Promise<CreateOrganizationResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_organization_for_current_user", {
    p_name: orgName.trim(),
    p_branch_name: branchName.trim(),
    p_plan_id: planId ?? null,
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

  return {
    success: true,
    organizationId: result.organization_id!,
    alreadyExisted: result.already_existed ?? false,
  };
}
