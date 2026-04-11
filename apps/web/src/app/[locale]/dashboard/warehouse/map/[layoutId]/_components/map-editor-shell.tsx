"use client";

/**
 * Thin client shell that lazy-loads MapEditor (react-konva) only on the client.
 * `ssr: false` is only valid inside a Client Component — this file exists purely
 * to satisfy that constraint so the Server Component page can render it.
 *
 * Also activates "flush content" mode on DashboardShell so <main> has no padding
 * or scroll, letting the editor fill the full available area.
 */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { WarehouseLayoutWithShapes } from "@/lib/warehouse/layouts";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { MapEditorLoading } from "./map-editor-loading";

const MapEditor = dynamic(() => import("./map-editor").then((m) => ({ default: m.MapEditor })), {
  ssr: false,
  loading: () => <MapEditorLoading />,
});

interface MapEditorShellProps {
  initialLayout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  branchId: string;
  canManage: boolean;
  canPublish: boolean;
}

export function MapEditorShell(props: MapEditorShellProps) {
  const setFlushContent = useUiStoreV2((s) => s.setFlushContent);

  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  return <MapEditor {...props} />;
}
