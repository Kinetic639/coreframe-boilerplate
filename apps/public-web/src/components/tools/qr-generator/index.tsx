"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QrManagementClient } from "@/app/[locale]/dashboard/qr/_components/qr-management-client";
import { listQrCodesAction } from "@/app/actions/qr/list";
import { paginateQrCodes } from "@/app/[locale]/dashboard/qr/_utils/data-view";
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import type { PaginatedResult } from "@/components/data-view/data-view.types";

interface LoadedState {
  initialData: PaginatedResult<QrCodeWithStatus>;
  allCodes: QrCodeWithStatus[];
}

/**
 * QR Generator Tool — registered in the tool registry under "qr-generator".
 *
 * Fetches QR codes on mount then renders QrManagementClient.
 * Permissions are resolved internally via usePermissions (no snapshot prop needed).
 */
export function QrGeneratorTool() {
  const [state, setState] = useState<LoadedState | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    listQrCodesAction().then((result) => {
      const codes = result.success
        ? (result as { success: true; data: QrCodeWithStatus[] }).data
        : [];
      setState({
        allCodes: codes,
        initialData: paginateQrCodes(codes, 1, 50),
      });
    });
  }, []);

  if (!state) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)]">
      <QrManagementClient initialData={state.initialData} allCodes={state.allCodes} />
    </div>
  );
}
