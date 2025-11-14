"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";

import {
  AdvancedDataTable,
  type AdvancedDataTableProps,
} from "@/components/ui/advanced-data-table";
import { useTableStore } from "@/components/ui/advanced-data-table/store/table-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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

  const openDetail = useTableStore((state) => state.openDetail) as (row: T) => void;
  const closeDetail = useTableStore((state) => state.closeDetail);
  const setLayoutMode = useTableStore((state) => state.setLayoutMode);

  const [internalSelectedId, setInternalSelectedId] = React.useState<string | null>(
    controlledSelectedId ?? null
  );

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
      if (controlledSelectedId === undefined) {
        setInternalSelectedId(null);
      }
      closeDetail();
      setLayoutMode("full");
    };
  }, [closeDetail, controlledSelectedId, setLayoutMode]);

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
      const targetPath = detailPathBuilder ? detailPathBuilder(row, id) : `${basePath}/${id}`;
      router[navigationMode](targetPath, { scroll: false });
    },
    [
      basePath,
      controlledSelectedId,
      detailPathBuilder,
      getRowId,
      navigateToDetail,
      navigationMode,
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
    router[navigationMode](basePath, { scroll: false });
  }, [basePath, closeDetail, controlledSelectedId, navigateToBase, navigationMode, router]);

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

  const { className: tableClassName, ...restTableProps } = tableProps;

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
      />
    </div>
  );
}
