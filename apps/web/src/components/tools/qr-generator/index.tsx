"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ListLoading } from "@/components/kolor-sensu/data-table/list-loading";
import { QrWorkspace } from "@/app/[locale]/dashboard/qr/_components/qr-workspace";
import { listQrCodesAction } from "@/app/actions/qr/list";
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import "@/components/kolor-sensu/data-table/ambra-list.css";

/**
 * QR Generator Tool — registered in the tool registry under "qr-generator".
 *
 * Fetches the QR codes once per organization, then renders the QR list on
 * the tool page's own address. Permissions are resolved inside the list.
 */
export function QrGeneratorTool() {
  const activeOrgId = useAppStoreV2((state) => state.activeOrgId);
  const pathname = usePathname();
  const [loaded, setLoaded] = useState<{ orgId: string; codes: QrCodeWithStatus[] } | null>(null);

  useEffect(() => {
    if (!activeOrgId) return;
    let live = true;
    listQrCodesAction().then((result) => {
      if (live) setLoaded({ orgId: activeOrgId, codes: result.success ? result.data : [] });
    });
    return () => {
      live = false;
    };
  }, [activeOrgId]);

  if (!activeOrgId || loaded?.orgId !== activeOrgId) {
    return <ListLoading actions={2} columns={4} tabs={0} selectable />;
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-0 flex-col">
      <QrWorkspace
        orgId={activeOrgId}
        initialCodes={loaded.codes}
        path={pathname}
        cookie={`ambra_qr_codes_tool_${activeOrgId}`}
      />
    </div>
  );
}
