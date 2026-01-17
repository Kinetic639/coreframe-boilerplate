"use client";

import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { PageHeaderV2 } from "@/components/v2/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Dashboard V2 Start Page
 *
 * Proof of concept page that validates V2 architecture
 *
 * Displays:
 * - App context (org, branch, modules) from useAppStoreV2
 * - User context (identity, roles, permissions) from useUserStoreV2
 * - Permission checks using usePermissions hook
 *
 * This page validates:
 * - SSR hydration works correctly
 * - Stores are populated from server context
 * - Permission checking works
 * - No console errors
 */
export default function DashboardV2StartPage() {
  const appStore = useAppStoreV2();
  const userStore = useUserStoreV2();
  const { can, getSnapshot } = usePermissions();

  const permissionSnapshot = getSnapshot();

  return (
    <div>
      <PageHeaderV2
        title="Dashboard V2 Start"
        description="Proof of concept page validating V2 architecture"
        breadcrumbs={[{ label: "Start" }]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* App Context Card */}
        <Card>
          <CardHeader>
            <CardTitle>App Context (useAppStoreV2)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div>
              <strong>isLoaded:</strong> {String(appStore.isLoaded)}
            </div>
            <div>
              <strong>activeOrgId:</strong> {appStore.activeOrgId || "null"}
            </div>
            <div>
              <strong>activeBranchId:</strong> {appStore.activeBranchId || "null"}
            </div>
            <div>
              <strong>activeOrg:</strong> {appStore.activeOrg?.name || "null"}
            </div>
            <div>
              <strong>activeBranch:</strong> {appStore.activeBranch?.name || "null"}
            </div>
            <div>
              <strong>availableBranches:</strong> {appStore.availableBranches.length}
            </div>
            <div>
              <strong>userModules:</strong>{" "}
              {appStore.userModules.map((m) => m.slug).join(", ") || "none"}
            </div>
          </CardContent>
        </Card>

        {/* User Context Card */}
        <Card>
          <CardHeader>
            <CardTitle>User Context (useUserStoreV2)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div>
              <strong>isLoaded:</strong> {String(userStore.isLoaded)}
            </div>
            <div>
              <strong>user:</strong> {userStore.user?.email || "null"}
            </div>
            <div>
              <strong>roles:</strong> {userStore.roles.length}
            </div>
            <div>
              <strong>permissions.allow:</strong> {permissionSnapshot.allow.length}
            </div>
            <div>
              <strong>permissions.deny:</strong> {permissionSnapshot.deny.length}
            </div>
          </CardContent>
        </Card>

        {/* Permission Checks Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Permission Checks (usePermissions)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div>
              <strong>can("warehouse.products.read"):</strong>{" "}
              {String(can("warehouse.products.read"))}
            </div>
            <div>
              <strong>can("warehouse.*"):</strong> {String(can("warehouse.*"))}
            </div>
            <div>
              <strong>can("admin.settings"):</strong> {String(can("admin.settings"))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
