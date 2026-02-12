import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { notFound, redirect } from "next/navigation";
import { EntitlementsAdminUI } from "./EntitlementsAdminUI";
import { createClient } from "@/utils/supabase/server";

/**
 * Entitlements Admin Page (SSR)
 *
 * This page allows org owners to view and manage their organization's entitlements in dev mode.
 * It provides a UI for:
 * - Viewing current plan and entitlements
 * - Switching between plans
 * - Adding/removing module addons
 * - Setting limit overrides
 * - Resetting to free plan
 *
 * **Security**:
 * - Only accessible to org_owner role (enforced SSR via is_org_owner RPC)
 * - Dev mode must be enabled in database (short-circuits before loading data)
 * - All mutations go through dev_* RPC functions with guards
 *
 * **SSR Pattern**:
 * - Loads all data server-side (no loading states)
 * - Client component handles interactions
 */
export default async function EntitlementsAdminPage() {
  const appContext = await loadAppContextServer();

  if (!appContext?.activeOrgId) {
    redirect("/");
  }

  const supabase = await createClient();

  // Security: Enforce org_owner role (returns 404 to hide page from non-owners)
  const { data: isOwner } = await supabase.rpc("is_org_owner", {
    p_org_id: appContext.activeOrgId,
  });
  if (!isOwner) notFound();

  // Load dev mode status FIRST — skip remaining queries if disabled
  const { data: config, error: configError } = await supabase
    .from("app_config")
    .select("dev_mode_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (configError) {
    console.error("[EntitlementsAdminPage] Failed to load app_config:", configError);
  }

  const devModeEnabled = config?.dev_mode_enabled ?? false;

  // Short-circuit: if dev mode is off, render with empty data (saves 4 DB queries)
  if (!devModeEnabled) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold">Entitlements Admin</h1>
            <p className="text-muted-foreground mt-2">
              View and manage your organization&apos;s subscription entitlements
            </p>
          </div>
          <EntitlementsAdminUI
            orgId={appContext.activeOrgId}
            entitlements={appContext.entitlements}
            plans={[]}
            addons={[]}
            overrides={[]}
            availableModuleSlugs={[]}
            devModeEnabled={false}
          />
        </div>
      </div>
    );
  }

  // Dev mode is ON — load all data for admin UI
  const { data: plans, error: plansError } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (plansError) {
    console.error("[EntitlementsAdminPage] Failed to load plans:", plansError);
  }

  const { data: addons, error: addonsError } = await supabase
    .from("organization_module_addons")
    .select("*")
    .eq("organization_id", appContext.activeOrgId)
    .eq("status", "active");

  if (addonsError) {
    console.error("[EntitlementsAdminPage] Failed to load addons:", addonsError);
  }

  const { data: overrides, error: overridesError } = await supabase
    .from("organization_limit_overrides")
    .select("*")
    .eq("organization_id", appContext.activeOrgId);

  if (overridesError) {
    console.error("[EntitlementsAdminPage] Failed to load overrides:", overridesError);
  }

  // Load available module slugs for Select dropdown validation
  const { data: moduleSlugsRaw, error: moduleSlugsError } = await supabase
    .from("modules")
    .select("slug")
    .is("deleted_at", null)
    .order("slug");

  if (moduleSlugsError) {
    console.error("[EntitlementsAdminPage] Failed to load module slugs:", moduleSlugsError);
  }

  const availableModuleSlugs = (moduleSlugsRaw ?? []).map((m) => m.slug);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Entitlements Admin</h1>
            <p className="text-muted-foreground mt-2">
              View and manage your organization&apos;s subscription entitlements
            </p>
          </div>
          <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-md text-sm font-medium">
            Dev Mode Enabled
          </div>
        </div>

        <EntitlementsAdminUI
          orgId={appContext.activeOrgId}
          entitlements={appContext.entitlements}
          plans={plans || []}
          addons={addons || []}
          overrides={overrides || []}
          availableModuleSlugs={availableModuleSlugs}
          devModeEnabled={true}
        />
      </div>
    </div>
  );
}
