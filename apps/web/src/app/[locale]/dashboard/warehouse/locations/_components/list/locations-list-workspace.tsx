"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { ClipboardCheck, LayoutGrid, LayoutList, Printer, TreePine, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import { Button } from "@/components/ui/button";
import { getQrAssignmentForLocationAction } from "@/app/actions/qr/assign-location";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import type { InventoryVariantOption } from "@/lib/warehouse/inventory-types";
import { cn } from "@/lib/utils";
import type { AmbraLocationInventorySnapshot, LogicalLocation } from "../../_ambra/types";
import { LocationDetailPanel } from "../location-detail-panel";
import { PrintLocationLabelsDialog } from "../print-location-labels-dialog";
import { LocationsListTable, type LocationRowCommands } from "./locations-list-table";
import {
  listLocations,
  locationHref,
  locationParsers,
  locationRows,
  STORES_STOCK,
  type LocationState,
} from "./locations-list-state";

export type QrAssignmentInfo = {
  assignmentId: string;
  qrCodeId: string;
  token: string;
  label: string | null;
  status: string;
};

/**
 * The locations list and its side panel, as the products and movements
 * lists: the address is the one state and every change only pushes a new
 * address. The rows are the branch's locations the page already has, so the
 * list answers at once, and it follows what the tree creates or changes.
 */
export function LocationsListWorkspace({
  path,
  locations,
  ambraLocations,
  inventorySnapshot,
  variantOptions,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  qrCache,
  onQrChange,
  onShowInTree,
}: {
  /** The tree view, with this location open. */
  onShowInTree: (id: string) => void;
  /** The page's own path (localized), without its query. */
  path: string;
  locations: WarehouseLocation[];
  /** The same locations, as the detail panel reads them. */
  ambraLocations: LogicalLocation[];
  inventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  qrCache: Map<string, QrAssignmentInfo | null>;
  onQrChange: (locationId: string, assignment: QrAssignmentInfo | null) => void;
}) {
  const router = useRouter();
  const [state] = useQueryStates(locationParsers);
  // The columns follow the menu at once; the cookie keeps them for the server.
  const [layout, setLayout] = useState(savedLayout);
  // Ticked rows, for printing labels or counting several locations at once.
  const [ticked, setTicked] = useState<string[]>([]);
  const [printIds, setPrintIds] = useState<string[] | null>(null);

  const rows = useMemo(() => locationRows(locations), [locations]);
  const list = useMemo(() => listLocations(rows, state), [rows, state]);
  const ambraById = useMemo(
    () => new Map(ambraLocations.map((location) => [location.id, location])),
    [ambraLocations]
  );

  // Ticks on locations that are gone (deleted in the tree) drop out.
  const liveTicked = useMemo(() => ticked.filter((id) => ambraById.has(id)), [ticked, ambraById]);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback(
    (patch: Partial<LocationState>) => locationHref(path, state, patch),
    [path, state]
  );
  const preview = useCallback(
    (selected: string | null) => navigate(href({ selected })),
    [href, navigate]
  );

  // A page past the end (a filter narrowed it): go to the last one.
  useEffect(() => {
    if (state.strona !== list.page) {
      window.history.replaceState(null, "", href({ strona: list.page }));
    }
  }, [href, list.page, state.strona]);

  const commands = useMemo<LocationRowCommands>(
    () => ({
      showInTree: onShowInTree,
      print: (ids) => setPrintIds(ids),
      audit: (ids) =>
        router.push({
          pathname: "/dashboard/warehouse/audits/new",
          query: { step: "2", countType: "location", locationIds: ids.join(",") },
        }),
    }),
    [onShowInTree, router]
  );

  // ↓ / ↑ open the next / previous location, Esc closes the panel. Keys typed
  // into a field, or with a modifier, stay the field's.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='listbox']"
        )
      ) {
        return;
      }
      if (event.key === "Escape" && state.selected) {
        event.preventDefault();
        preview(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!list.rows.length) return;
      const at = list.rows.findIndex((row) => row.id === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(list.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      const id = list.rows[next].id;
      preview(id);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [list.rows, preview, state.selected]);

  const modes = useMemo(
    () =>
      [...new Set(rows.map((row) => row.storage_mode).filter((mode): mode is string => !!mode))]
        .sort()
        .map((value) => ({ value, label: labels[`mode_${value}`] ?? value })),
    [labels, rows]
  );
  const levels = useMemo(
    () =>
      [...new Set(rows.map((row) => row.level))]
        .sort((a, b) => a - b)
        .map((value) => ({ value: String(value), label: String(value) })),
    [rows]
  );
  const fields: FilterField[] = [
    {
      kind: "list",
      id: "poziom",
      label: labels.level,
      options: levels,
    },
    {
      kind: "list",
      id: "tryb",
      label: labels.storageMode,
      options: modes,
    },
    {
      kind: "list",
      id: "magazynowa",
      label: labels.canStoreInventory,
      options: STORES_STOCK.map((value) => ({
        value,
        label: value === "tak" ? labels.yes : labels.no,
      })),
    },
  ];
  // The filter ids that are not columns sit where their column is.
  const order = [
    "code",
    ...layout.map((column) =>
      column.id === "level"
        ? "poziom"
        : column.id === "storage_mode"
          ? "tryb"
          : column.id === "can_store_inventory"
            ? "magazynowa"
            : column.id
    ),
  ];

  const selectedLocation = state.selected ? (ambraById.get(state.selected) ?? null) : null;
  const selectedRow = state.selected ? rows.find((row) => row.id === state.selected) : undefined;

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="ks-list-view flex h-full min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
            <span className="text-xs tabular-nums text-muted-foreground">{list.totalCount}</span>
          </div>
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={locationParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            order={order}
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        {liveTicked.length ? (
          <div
            role="region"
            aria-label={labels.selection}
            className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm"
          >
            <span className="font-medium tabular-nums">
              {labels.selectedCount.replace("{count}", String(liveTicked.length))}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setPrintIds(liveTicked)}
            >
              <Printer className="size-3.5" />
              {labels.printSelected.replace("{count}", String(liveTicked.length))}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => commands.audit(liveTicked)}
            >
              <ClipboardCheck className="size-3.5" />
              {labels.auditSelected.replace("{count}", String(liveTicked.length))}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto gap-1.5"
              onClick={() => setTicked([])}
            >
              <X className="size-3.5" />
              {labels.clearSelection}
            </Button>
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1">
          <LocationsListTable
            rows={list.rows}
            totalCount={list.totalCount}
            state={{ ...state, strona: list.page }}
            path={path}
            set={set}
            layout={layout}
            widths={widths}
            cookie={cookie}
            labels={labels}
            ticked={liveTicked}
            onTickedChange={setTicked}
            commands={commands}
            onLayoutChange={setLayout}
            onPreview={preview}
          />
          {state.selected ? (
            <LocationRecordPanel
              key={state.selected}
              locationId={state.selected}
              code={selectedRow?.code ?? selectedRow?.name ?? null}
              location={selectedLocation}
              pathCode={selectedRow?.path ?? ""}
              ambraLocations={ambraLocations}
              inventorySnapshot={inventorySnapshot}
              variantOptions={variantOptions}
              labels={labels}
              onShowInTree={() => onShowInTree(state.selected!)}
              qrCache={qrCache}
              onQrChange={onQrChange}
              onAudit={() => commands.audit([state.selected!])}
              onClose={() => preview(null)}
            />
          ) : null}
        </div>
      </section>
      <PrintLocationLabelsDialog
        open={printIds !== null}
        onOpenChange={(open) => {
          if (!open) setPrintIds(null);
        }}
        locationIds={printIds ?? []}
        locationsById={ambraById}
      />
    </TableNavigationProvider>
  );
}

function LocationRecordPanel({
  locationId,
  code,
  location,
  pathCode,
  ambraLocations,
  inventorySnapshot,
  variantOptions,
  labels,
  onShowInTree,
  qrCache,
  onQrChange,
  onAudit,
  onClose,
}: {
  locationId: string;
  code: string | null;
  /** Null: not a location of this branch (or deleted). */
  location: LogicalLocation | null;
  pathCode: string;
  ambraLocations: LogicalLocation[];
  inventorySnapshot: AmbraLocationInventorySnapshot;
  variantOptions: InventoryVariantOption[];
  labels: Record<string, string>;
  onShowInTree: () => void;
  qrCache: Map<string, QrAssignmentInfo | null>;
  onQrChange: (locationId: string, assignment: QrAssignmentInfo | null) => void;
  onAudit: () => void;
  onClose: () => void;
}) {
  const [compact, setCompact] = useState(false);
  const known = qrCache.has(locationId);

  // The location's QR code, once per location (the tree shares the cache).
  useEffect(() => {
    if (known || !location) return;
    let live = true;
    getQrAssignmentForLocationAction(locationId)
      .then((result) => {
        if (live) {
          onQrChange(
            locationId,
            result.success && result.data ? (result.data as QrAssignmentInfo) : null
          );
        }
      })
      .catch(() => {
        if (live) onQrChange(locationId, null);
      });
    return () => {
      live = false;
    };
  }, [known, location, locationId, onQrChange]);

  const toggle = (value: boolean, title: string, Icon: typeof LayoutGrid) => (
    <button
      type="button"
      onClick={() => setCompact(value)}
      aria-pressed={compact === value}
      title={title}
      aria-label={title}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        compact === value
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
    </button>
  );

  return (
    <aside
      aria-labelledby="location-panel-title"
      className="ks-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-2xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={labels.close}
        >
          <X className="size-4" />
          <span className="hidden sm:inline">{labels.title}</span>
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span id="location-panel-title" className="truncate font-mono text-sm">
          {code ?? locationId}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {location ? (
            <>
              <div className="hidden items-center gap-0.5 rounded-lg border p-0.5 sm:flex">
                {toggle(false, labels.bentoView, LayoutGrid)}
                {toggle(true, labels.streamlinedView, LayoutList)}
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onAudit}>
                <ClipboardCheck className="size-3.5" />
                <span className="hidden md:inline">{labels.auditLocation}</span>
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onShowInTree}>
            <TreePine className="size-3.5" />
            <span className="hidden sm:inline">{labels.showInTree}</span>
          </Button>
        </div>
      </header>
      {location ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <LocationDetailPanel
            location={location}
            allLocations={ambraLocations}
            inventorySnapshot={inventorySnapshot}
            variantOptions={variantOptions}
            pathCode={pathCode}
            compact={compact}
            qrAssignment={qrCache.get(locationId) ?? null}
            onQrAssigned={(assignment) => onQrChange(locationId, assignment)}
            onQrUnassigned={() => onQrChange(locationId, null)}
          />
        </div>
      ) : (
        <p className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">
          {labels.notFound}
        </p>
      )}
    </aside>
  );
}
