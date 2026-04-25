import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { QrCodesService } from "@/server/services/qr.service";
import { QrManagementClient } from "./_components/qr-management-client";

export default async function QrCodesPage() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? "";

  const result = orgId ? await QrCodesService.listWithStatus(supabase, orgId) : null;
  const initialCodes = result?.success ? result.data : [];

  const snapshot = context?.user.permissionSnapshot ?? { allow: [], deny: [] };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">QR Codes</h1>
        <p className="text-sm text-muted-foreground">
          Generate, manage, and export QR codes as PDF sticker sheets or Zebra ZPL files.
        </p>
      </div>
      <QrManagementClient initialCodes={initialCodes} permissionSnapshot={snapshot} />
    </div>
  );
}
