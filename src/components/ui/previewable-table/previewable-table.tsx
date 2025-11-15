"use client";

import * as React from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

import {
  AdvancedDataTable,
  type AdvancedDataTableProps,
} from "@/components/ui/advanced-data-table";
import { useTableStore } from "@/components/ui/advanced-data-table/store/table-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { isFilterActive } from "@/components/ui/advanced-data-table/utils/filter-utils";
import type { ActiveFilters, FilterValue } from "@/components/ui/advanced-data-table/types";

export interface PreviewableTableHeader {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export interface PreviewableTableProps<T>
  extends Omit<AdvancedDataTableProps<T>, "onRowClick" | "renderDetail"> {
  /** Base path used when resetting the preview (without selected id). */
  basePath: string;
  /** Optional controlled selected id taken from the current route. */
  selectedId?: string | null;
  /** Custom builder for the path that should be pushed when a row is selected. */
  detailPathBuilder?: (row: T, id: string) => string;
  /** Override the navigation method that should run when a row is selected. */
  navigateToDetail?: (row: T, id: string) => void;
  /** Override the navigation used when closing a preview. */
  navigateToBase?: () => void;
  /** Choose whether navigation should use push (default) or replace semantics. */
  navigationMode?: "push" | "replace";
  /** Optional wrapper header rendered above the table. */
  header?: PreviewableTableHeader;
  /** Additional class name applied to the outer layout container. */
  layoutClassName?: string;
  /** Placeholder shown above the table when nothing is selected. */
  idleState?: React.ReactNode;
  /** Content displayed when an id is present in the URL but no row matches it. */
  notFoundState?: React.ReactNode;
  /** Callback fired whenever the active row changes due to URL sync. */
  onActiveRowChange?: (row: T | null) => void;
  /** Custom renderer for the detail preview. */
  renderDetail?: AdvancedDataTableProps<T>["renderDetail"];
}

const defaultGetRowId = (row: any) => String(row.id);

const FILTER_QUERY_PREFIX = "ft.";
const SEARCH_QUERY_KEY = "sq";

function serializeFilterState(filters: ActiveFilters, searchQuery: string) {
  const params = new URLSearchParams();

  if (searchQuery) {
    params.set(SEARCH_QUERY_KEY, searchQuery);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (isFilterActive(value)) {
      params.set(`${FILTER_QUERY_PREFIX}${key}`, JSON.stringify(value));
    }
  });

  return params.toString();
}

function extractFiltersFromParams(params: URLSearchParams): ActiveFilters {
  const result: ActiveFilters = {};

  params.forEach((rawValue, key) => {
    if (!key.startsWith(FILTER_QUERY_PREFIX)) {
      return;
    }

    const columnKey = key.slice(FILTER_QUERY_PREFIX.length);

    try {
      const parsed = JSON.parse(rawValue) as FilterValue;
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        result[columnKey] = parsed;
      }
    } catch {
      // Ignore malformed filter values.
    }
  });

  return result;
}

function extractSearchQueryFromParams(params: URLSearchParams) {
  return params.get(SEARCH_QUERY_KEY) ?? "";
}

function mergePathWithQuery(path: string, queryString: string) {
  if (!queryString) {
    return path;
  }

  const [pathname, existingQuery = ""] = path.split("?");
  const mergedParams = new URLSearchParams(existingQuery);
  const additionalParams = new URLSearchParams(queryString);

  additionalParams.forEach((value, key) => {
    mergedParams.set(key, value);
  });

  const mergedQuery = mergedParams.toString();
  return mergedQuery ? `${pathname}?${mergedQuery}` : pathname;
}

export function PreviewableTable<T>({
  basePath,
  selectedId: controlledSelectedId,
  detailPathBuilder,
  navigateToDetail,
  navigateToBase,
  navigationMode = "push",
  header,
  layoutClassName,
  idleState,
  notFoundState,
  onActiveRowChange,
  renderDetail,
  data,
  columns,
  getRowId = defaultGetRowId,
  ...tableProps
}: PreviewableTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openDetail = useTableStore((state) => state.openDetail) as (row: T) => void;
  const closeDetail = useTableStore((state) => state.closeDetail);
  const setLayoutMode = useTableStore((state) => state.setLayoutMode);
  const filters = useTableStore((state) => state.filters);
  const setFilters = useTableStore((state) => state.setFilters);
  const searchQuery = useTableStore((state) => state.searchQuery);
  const setSearchQuery = useTableStore((state) => state.setSearchQuery);

  const [internalSelectedId, setInternalSelectedId] = React.useState<string | null>(
    controlledSelectedId ?? null
  );

  const { className: tableClassName, persistFiltersInUrl = false, ...restTableProps } = tableProps;

  const filterStateKey = React.useMemo(() => {
    if (!persistFiltersInUrl) {
      return "";
    }

    return serializeFilterState(filters, searchQuery);
  }, [filters, persistFiltersInUrl, searchQuery]);

  const lastSyncedStateRef = React.useRef<string>("");
  const lastUpdateSourceRef = React.useRef<"store" | "url" | null>(null);
  const skipInitialCleanupRef = React.useRef(process.env.NODE_ENV !== "production");
  const cleanupActionsRef = React.useRef({
    closeDetail,
    setLayoutMode,
    shouldResetInternal: controlledSelectedId === undefined,
  });

  React.useEffect(() => {
    cleanupActionsRef.current = {
      closeDetail,
      setLayoutMode,
      shouldResetInternal: controlledSelectedId === undefined,
    };
  }, [closeDetail, controlledSelectedId, setLayoutMode]);

  React.useEffect(() => {
    if (!persistFiltersInUrl) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const filterParams = new URLSearchParams();

    params.forEach((value, key) => {
      if (key.startsWith(FILTER_QUERY_PREFIX) || key === SEARCH_QUERY_KEY) {
        filterParams.set(key, value);
      }
    });

    const urlStateKey = filterParams.toString();

    if (urlStateKey === lastSyncedStateRef.current && lastUpdateSourceRef.current === "store") {
      lastUpdateSourceRef.current = null;
      return;
    }

    if (urlStateKey === filterStateKey) {
      lastSyncedStateRef.current = urlStateKey;
      lastUpdateSourceRef.current = "url";
      return;
    }

    lastSyncedStateRef.current = urlStateKey;
    lastUpdateSourceRef.current = "url";

    const nextFilters = extractFiltersFromParams(filterParams);
    const nextSearchQuery = extractSearchQueryFromParams(filterParams);

    setFilters(nextFilters);
    setSearchQuery(nextSearchQuery);
  }, [filterStateKey, persistFiltersInUrl, searchParams, setFilters, setSearchQuery]);

  React.useEffect(() => {
    if (!persistFiltersInUrl) {
      return;
    }

    if (filterStateKey === lastSyncedStateRef.current && lastUpdateSourceRef.current === "url") {
      lastUpdateSourceRef.current = null;
      return;
    }

    lastSyncedStateRef.current = filterStateKey;
    lastUpdateSourceRef.current = "store";

    const currentParams = new URLSearchParams(searchParams?.toString() ?? "");
    Array.from(currentParams.keys()).forEach((key) => {
      if (key.startsWith(FILTER_QUERY_PREFIX) || key === SEARCH_QUERY_KEY) {
        currentParams.delete(key);
      }
    });

    if (filterStateKey) {
      const nextFilterParams = new URLSearchParams(filterStateKey);
      nextFilterParams.forEach((value, key) => {
        currentParams.set(key, value);
      });
    }

    const currentSearchString = searchParams?.toString() ?? "";
    const nextSearchString = currentParams.toString();

    if (nextSearchString === currentSearchString) {
      return;
    }

    const nextHref = nextSearchString ? `${pathname}?${nextSearchString}` : pathname;
    router.replace(nextHref, { scroll: false });
  }, [filterStateKey, pathname, persistFiltersInUrl, router, searchParams]);

  // Keep the internal state in sync when the selection is controlled by the route.
  React.useEffect(() => {
    if (controlledSelectedId !== undefined) {
      setInternalSelectedId(controlledSelectedId ?? null);
    }
  }, [controlledSelectedId]);

  const selectedId =
    controlledSelectedId !== undefined ? (controlledSelectedId ?? null) : internalSelectedId;

  const selectedRow = React.useMemo(() => {
    if (!selectedId) return null;
    return data.find((item) => getRowId(item) === selectedId) ?? null;
  }, [data, getRowId, selectedId]);

  // Sync the Zustand table store with the currently selected row so the detail panel opens.
  React.useEffect(() => {
    if (selectedRow) {
      openDetail(selectedRow);
    } else if (!selectedId) {
      closeDetail();
    }
  }, [closeDetail, openDetail, selectedId, selectedRow]);

  // Force the layout mode based on whether something is selected.
  React.useEffect(() => {
    if (selectedId) {
      setLayoutMode("sidebar-detail");
    } else {
      setLayoutMode("full");
    }
  }, [selectedId, setLayoutMode]);

  // Notify about active row changes.
  React.useEffect(() => {
    onActiveRowChange?.(selectedRow);
  }, [onActiveRowChange, selectedRow]);

  React.useEffect(() => {
    return () => {
      if (skipInitialCleanupRef.current) {
        skipInitialCleanupRef.current = false;
        return;
      }

      const { closeDetail, setLayoutMode, shouldResetInternal } = cleanupActionsRef.current;
      if (shouldResetInternal) {
        setInternalSelectedId(null);
      }
      closeDetail();
      setLayoutMode("full");
    };
  }, []);

  const handleRowClick = React.useCallback(
    (row: T) => {
      const id = getRowId(row);
      if (controlledSelectedId === undefined) {
        setInternalSelectedId(id);
      }
      if (navigateToDetail) {
        navigateToDetail(row, id);
        return;
      }
      const baseTarget = detailPathBuilder ? detailPathBuilder(row, id) : `${basePath}/${id}`;
      const targetPath = persistFiltersInUrl
        ? mergePathWithQuery(baseTarget, filterStateKey)
        : baseTarget;
      router[navigationMode](targetPath, { scroll: false });
    },
    [
      basePath,
      controlledSelectedId,
      filterStateKey,
      detailPathBuilder,
      getRowId,
      navigateToDetail,
      navigationMode,
      persistFiltersInUrl,
      router,
    ]
  );

  const handleClose = React.useCallback(() => {
    if (controlledSelectedId === undefined) {
      setInternalSelectedId(null);
    }
    closeDetail();
    if (navigateToBase) {
      navigateToBase();
      return;
    }
    const baseTarget = persistFiltersInUrl
      ? mergePathWithQuery(basePath, filterStateKey)
      : basePath;
    router[navigationMode](baseTarget, { scroll: false });
  }, [
    basePath,
    closeDetail,
    controlledSelectedId,
    filterStateKey,
    navigateToBase,
    navigationMode,
    persistFiltersInUrl,
    router,
  ]);

  const wrappedRenderDetail = React.useMemo(() => {
    if (!renderDetail) return undefined;
    return (row: T, _onClose: () => void) => renderDetail(row, handleClose);
  }, [handleClose, renderDetail]);

  const selectionNotFound = Boolean(selectedId && !selectedRow && !tableProps.loading);

  const defaultNotFoundState = (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>Preview unavailable</AlertTitle>
      <AlertDescription>The requested record could not be found.</AlertDescription>
    </Alert>
  );

  const defaultIdleState = (
    <Alert className="mb-4">
      <AlertTitle>Select a record</AlertTitle>
      <AlertDescription>
        Choose an entry from the table to open its detail preview without leaving the page.
      </AlertDescription>
    </Alert>
  );

  return (
    <div className={cn("flex h-full flex-col gap-4", layoutClassName)}>
      {header ? (
        <div className="space-y-2">
          {header.title ? <h1 className="text-2xl font-semibold">{header.title}</h1> : null}
          {header.description ? (
            <p className="text-sm text-muted-foreground">{header.description}</p>
          ) : null}
          {header.actions ? <div className="flex flex-wrap gap-2">{header.actions}</div> : null}
        </div>
      ) : null}

      {!selectedId && (idleState ?? defaultIdleState)}
      {selectionNotFound && (notFoundState ?? defaultNotFoundState)}

      <AdvancedDataTable<T>
        {...(restTableProps as AdvancedDataTableProps<T>)}
        data={data}
        columns={columns}
        getRowId={getRowId}
        onRowClick={handleRowClick}
        renderDetail={wrappedRenderDetail}
        className={cn("flex-1", tableClassName)}
        persistFiltersInUrl={persistFiltersInUrl}
      />
    </div>
  );
}
