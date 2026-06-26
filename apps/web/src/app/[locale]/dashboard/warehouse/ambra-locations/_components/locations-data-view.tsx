"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, LayoutGrid, LayoutList, X } from "lucide-react";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/lib/data-view/types";
import { Badge } from "@/components/ui/badge";
import type { LocationListRow } from "@/server/services/warehouse-locations.service";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import type { LogicalLocation, AmbraLocationInventorySnapshot } from "../_ambra/types";
import type { InventoryVariantOption } from "@/lib/warehouse/inventory-types";
import { warehouseLocationsToAmbra } from "../_lib/warehouse-location-adapter";
import {
  listLocationsPaginatedAction,
  getLocationDetailAction,
} from "@/app/actions/warehouse/locations";
import { LocationDetailPanel } from "./location-detail-panel";

type LocationDetailData = {
  location: LogicalLocation;
  pathCode: string;
  allLocations: LogicalLocation[];
  inventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
};

type Props = {
  initialData: PaginatedResult<LocationListRow>;
  allLocations: WarehouseLocation[];
  ambraLocations: LogicalLocation[];
  inventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
};

async function listFetcher(params: DataViewListParams) {
  const result = await listLocationsPaginatedAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "unauthorized");
  return result.data;
}

export function LocationsDataView({
  initialData,
  allLocations,
  ambraLocations,
  inventorySnapshot,
  variantOptions,
}: Props) {
  const t = useTranslations("warehouseLocations.listView");
  const tAmbra = useTranslations("ambraLocations");
  const [isCompactMode, setIsCompactMode] = useState(false);

  const locationById = useMemo(() => {
    const map = new Map<string, LogicalLocation>();
    for (const loc of ambraLocations) map.set(loc.id, loc);
    return map;
  }, [ambraLocations]);

  const pathCodeCache = useMemo(() => {
    const codeById = new Map(allLocations.map((l) => [l.id, l.code ?? l.name]));
    const parentById = new Map(allLocations.map((l) => [l.id, l.parent_id]));
    const cache = new Map<string, string>();
    function build(id: string): string {
      if (cache.has(id)) return cache.get(id)!;
      const parts: string[] = [];
      let cur: string | null | undefined = id;
      while (cur) {
        const code = codeById.get(cur);
        if (code) parts.unshift(code);
        cur = parentById.get(cur);
      }
      const p = parts.join(" / ");
      cache.set(id, p);
      return p;
    }
    for (const loc of allLocations) build(loc.id);
    return cache;
  }, [allLocations]);

  const locationByIdRef = useRef(locationById);
  locationByIdRef.current = locationById;
  const pathCodeCacheRef = useRef(pathCodeCache);
  pathCodeCacheRef.current = pathCodeCache;

  const ambraLocationsRef = useRef(ambraLocations);
  ambraLocationsRef.current = ambraLocations;
  const inventorySnapshotRef = useRef(inventorySnapshot);
  inventorySnapshotRef.current = inventorySnapshot;
  const variantOptionsRef = useRef(variantOptions);
  variantOptionsRef.current = variantOptions;

  const detailFetcher = useCallback(async (id: string): Promise<LocationDetailData | null> => {
    const cached = locationByIdRef.current.get(id);
    if (cached) {
      return {
        location: cached,
        pathCode: pathCodeCacheRef.current.get(id) ?? "",
        allLocations: ambraLocationsRef.current,
        inventorySnapshot: inventorySnapshotRef.current,
        variantOptions: variantOptionsRef.current,
      };
    }
    try {
      const result = (await getLocationDetailAction(id)) as any;
      if (!result.success || !result.data) return null;
      const [converted] = warehouseLocationsToAmbra([result.data]);
      if (!converted) return null;
      return {
        location: converted,
        pathCode: converted.pathCode ?? converted.name,
        allLocations: ambraLocationsRef.current,
        inventorySnapshot: inventorySnapshotRef.current,
        variantOptions: variantOptionsRef.current,
      };
    } catch {
      return null;
    }
  }, []);

  const columns = useMemo<DataViewColumnDef<LocationListRow>[]>(
    () => [
      {
        key: "code",
        header: t("code"),
        accessor: (row) => <span className="font-mono font-medium">{row.code ?? "—"}</span>,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "name",
        header: t("name"),
        accessor: (row) => (
          <div className="flex items-center gap-2">
            {row.color && (
              <span
                className="inline-block h-3 w-3 rounded-full border shrink-0"
                style={{ backgroundColor: row.color }}
              />
            )}
            <span className="font-medium">{row.name}</span>
          </div>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "path",
        header: t("path"),
        accessor: (row) => (
          <span className="text-xs text-muted-foreground truncate block max-w-[300px]">
            {row.path}
          </span>
        ),
        defaultVisible: true,
      },
      {
        key: "level",
        header: t("level"),
        accessor: (row) => (
          <Badge variant="outline" className="text-xs">
            {row.level}
          </Badge>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "storage_mode",
        header: t("storageMode"),
        accessor: (row) =>
          row.storage_mode ? (
            <Badge variant="secondary" className="text-xs">
              {row.storage_mode}
            </Badge>
          ) : (
            <span className="text-muted-foreground">{"—"}</span>
          ),
        defaultVisible: true,
      },
      {
        key: "can_store_inventory",
        header: t("canStoreInventory"),
        accessor: (row) =>
          row.can_store_inventory ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground/40" />
          ),
        defaultVisible: true,
      },
    ],
    [t]
  );

  const filters: DataViewFilterDef[] = [
    {
      type: "select",
      key: "can_store_inventory",
      label: t("canStoreInventory"),
      options: [{ label: t("yes"), value: "true" }],
    },
    {
      type: "select",
      key: "storage_mode",
      label: t("storageMode"),
      options: ["warehouse", "zone", "aisle", "rack", "shelf", "bin"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    {
      type: "select",
      key: "level",
      label: t("level"),
      options: Array.from({ length: 6 }, (_, i) => ({
        label: String(i),
        value: String(i),
      })),
    },
  ];

  return (
    <DataView<LocationListRow, LocationDetailData>
      entity="locations"
      columns={columns}
      filters={filters}
      initialData={initialData}
      queryKey={["locations"]}
      listFetcher={listFetcher}
      detailFetcher={detailFetcher}
      getRowId={(row) => row.id}
      renderDetail={(detail) => (
        <LocationDetailPanel
          location={detail.location}
          allLocations={detail.allLocations}
          inventorySnapshot={detail.inventorySnapshot}
          variantOptions={detail.variantOptions}
          pathCode={detail.pathCode}
          compact={isCompactMode}
          headerActions={
            <div className="flex items-center gap-1 bg-background/80 rounded-xl p-1 border border-border">
              <button
                onClick={() => setIsCompactMode(false)}
                className={`p-2 rounded-lg transition-all ${!isCompactMode ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/20" : "text-muted-foreground hover:text-foreground/80 border border-transparent"}`}
                title={tAmbra("actions.bentoView")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsCompactMode(true)}
                className={`p-2 rounded-lg transition-all ${isCompactMode ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/20" : "text-muted-foreground hover:text-foreground/80 border border-transparent"}`}
                title={tAmbra("actions.streamlinedView")}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          }
        />
      )}
      className="h-full"
    />
  );
}
