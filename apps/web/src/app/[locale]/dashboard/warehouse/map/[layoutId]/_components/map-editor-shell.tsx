"use client";

/**
 * Thin client shell that lazy-loads MapEditor (react-konva) only on the client.
 * `ssr: false` is only valid inside a Client Component — this file exists purely
 * to satisfy that constraint so the Server Component page can render it.
 */

import dynamic from "next/dynamic";
import type { WarehouseLayoutWithShapes } from "@/lib/warehouse/layouts";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";

const MapEditor = dynamic(() => import("./map-editor").then((m) => ({ default: m.MapEditor })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

interface MapEditorShellProps {
  initialLayout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  branchId: string;
  canManage: boolean;
  canPublish: boolean;
}

export function MapEditorShell(props: MapEditorShellProps) {
  return <MapEditor {...props} />;
}
