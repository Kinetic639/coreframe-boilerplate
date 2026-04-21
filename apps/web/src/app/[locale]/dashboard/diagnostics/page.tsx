"use client";

import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { PageHeaderV2 } from "@/components/v2/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionDebugPanel } from "@/components/v2/debug/permission-debug-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "react-toastify";

function ToastTestPanel() {
  const [message, setMessage] = useState(
    "This is a test toast message with some details: ERR_CODE_4291"
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Toast Copy Feature Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Message to show in toast</label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter toast message..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => toast.success(message)}>
            Success
          </Button>
          <Button size="sm" variant="destructive" onClick={() => toast.error(message)}>
            Error
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.info(message)}>
            Info
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast.warning(message)}>
            Warning
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fire a toast, then click the <strong>copy icon</strong> (📋) next to the ✕ button. The
          message text should be copied to your clipboard.
        </p>
      </CardContent>
    </Card>
  );
}

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

      <ToastTestPanel />

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
