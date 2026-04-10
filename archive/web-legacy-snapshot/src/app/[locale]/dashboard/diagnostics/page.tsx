"use client";

import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { PageHeaderV2 } from "@/components/v2/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionDebugPanel } from "@/components/v2/debug/permission-debug-panel";

export default function DiagnosticsPage() {
  const appStore = useAppStoreV2();
  const userStore = useUserStoreV2();
  const { can, getSnapshot } = usePermissions();

  const permissionSnapshot = getSnapshot();

  return (
    <div className="space-y-6">
      <PageHeaderV2
        title="Diagnostics"
        description="System diagnostics — permission system, context state, and architecture validation"
      />

      <PermissionDebugPanel />

      <div className="grid gap-4 md:grid-cols-2">
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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Permission Checks (usePermissions)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div>
              <strong>can(&quot;warehouse.products.read&quot;):</strong>{" "}
              {String(can("warehouse.products.read"))}
            </div>
            <div>
              <strong>can(&quot;warehouse.*&quot;):</strong> {String(can("warehouse.*"))}
            </div>
            <div>
              <strong>can(&quot;admin.settings&quot;):</strong> {String(can("admin.settings"))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
