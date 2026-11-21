"use client";

import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  ExternalLink,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import {
  defaultLayout,
  type ColumnLayout,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { TableNavigationProvider } from "@/components/data-table/table-navigation";
import { ListPane, ListSidePanel } from "@/components/data-table/list-pane";
import { useListKeys } from "@/components/data-table/use-list-keys";
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { QR_CREATE, QR_REVOKE, QR_EXPORT } from "@/lib/constants/permissions";
import { listQrCodesAction } from "@/app/actions/qr/list";
import { createQrBatchAction } from "@/app/actions/qr/create-batch";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import {
  deleteQrCodesAction,
  restoreQrCodesAction,
  revokeQrCodesAction,
} from "@/app/actions/qr/registry";
import { QrSettingsDialog } from "./qr-settings-dialog";
import { PRIMARY_FIELD_KEY, TOKEN_FIELD_KEY, SCAN_URL_FIELD_KEY } from "@/lib/qr/label-config";
import {
  getQrStatus,
  qrColumnSet,
  qrHref,
  qrListLabels,
  qrPage,
  qrParsers,
  QR_PAGE_SIZES,
  QR_STATUSES,
  QR_UNUSED_DAYS,
  type QrDisplayStatus,
  type QrState,
} from "./qr-state";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

const STATUS_VARIANT: Record<QrDisplayStatus, "default" | "secondary" | "destructive"> = {
  assigned: "default",
  unassigned: "secondary",
  expired: "secondary",
  revoked: "destructive",
};

type BulkAction = "revoke" | "delete";

export const qrCodesKey = (orgId: string) => ["qr-codes", orgId] as const;

/**
 * The QR codes: all of them, filtered, sorted and paged by the address, with
 * the open one beside the list. Ticked codes go on to the label designer.
 * Used by the QR page and by the QR generator tool (on its own address).
 */
export function QrWorkspace({
  orgId,
  initialCodes,
  path,
  layout: savedLayout,
  widths = {},
  cookie,
  allowGenerate = true,
}: {
  orgId: string;
  initialCodes: QrCodeWithStatus[];
  /** The page the list's links lead to (its own address). */
  path: string;
  layout?: ColumnLayout;
  widths?: ColumnWidths;
  cookie: string;
  /**
   * Show the "generate N codes" form. The registry page (Organization → QR
   * codes) leaves it out: codes are made by printing labels or assigning.
   */
  allowGenerate?: boolean;
}) {
  const t = useTranslations("modules.qr.management");
  const tDesigner = useTranslations("modules.qr.designer");
  const locale = useLocale();
  const labels = useMemo(() => qrListLabels(t as (key: string) => string, locale), [t, locale]);
  const set = useMemo(() => qrColumnSet(labels), [labels]);
  const { can } = usePermissions();
  const canCreate = can(QR_CREATE);
  const canRevoke = can(QR_REVOKE);
  const canExport = can(QR_EXPORT);

  const queryClient = useQueryClient();
  const codes = useQuery({
    queryKey: qrCodesKey(orgId),
    queryFn: async () => {
      const result = await listQrCodesAction();
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    initialData: initialCodes,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const all = useMemo(() => codes.data ?? [], [codes.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: qrCodesKey(orgId) });

  const [state] = useQueryStates(qrParsers);
  const page = useMemo(() => qrPage(all, state), [all, state]);
  const [layout, setLayout] = useState(() => savedLayout ?? defaultLayout(set));

  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback((patch: Partial<QrState>) => qrHref(path, state, patch), [path, state]);
  const preview = useCallback(
    (selected: string | null) => navigate(href({ selected })),
    [navigate, href]
  );
  const keys = useMemo(() => page.rows.map((row) => row.id), [page.rows]);
  useListKeys(keys, state.selected, preview);
  useEffect(() => {
    if (state.strona !== page.page) {
      window.history.replaceState(null, "", href({ strona: page.page }));
    }
  }, [href, page.page, state.strona]);

  // Codes ticked for the label designer (across pages and filters).
  const [ticked, setTicked] = useState<string[]>([]);
  const [activeStage, setActiveStage] = useState<"select" | "design">("select");
  const [designIds, setDesignIds] = useState<string[]>([]);
  const [labelFormat, setLabelFormat] = useState<"pdf" | "zpl">("pdf");

  const [generateCount, setGenerateCount] = useState(1);
  const [labelPrefix, setLabelPrefix] = useState("");
  const [isGenerating, startGenerate] = useTransition();
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [isRevoking, startRevoke] = useTransition();
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [isBulkRunning, startBulk] = useTransition();
  const [settingsOpen, setSettingsOpen] = useState(false);

  function handleGenerate() {
    startGenerate(async () => {
      const result = await createQrBatchAction({
        count: generateCount,
        labelPrefix: labelPrefix.trim() || undefined,
      });
      if (result.success) {
        toast.success(t("toasts.created", { count: result.data.length }));
        await refresh();
        setLabelPrefix("");
        setGenerateCount(1);
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  function handleRevokeConfirm() {
    if (!revokeTarget) return;
    const id = revokeTarget;
    setRevokeTarget(null);
    startRevoke(async () => {
      const result = await revokeQrAction({ qrCodeId: id });
      if (result.success) {
        toast.success(t("toasts.revoked"));
        await refresh();
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  function runBulk(action: BulkAction | "restore", ids: string[]) {
    if (ids.length === 0) return;
    startBulk(async () => {
      const result =
        action === "revoke"
          ? await revokeQrCodesAction({ ids })
          : action === "delete"
            ? await deleteQrCodesAction({ ids })
            : await restoreQrCodesAction({ ids });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      const count = result.data;
      if (action === "revoke") toast.success(t("registry.revokedMany", { count }));
      if (action === "restore") toast.success(t("registry.restoredMany", { count }));
      if (action === "delete") {
        toast.success(t("registry.deletedMany", { count }));
        if (count < ids.length) {
          toast.info(t("registry.deletedSkipped", { count: ids.length - count }));
        }
      }
      setTicked((now) => (action === "restore" ? now : now.filter((id) => !ids.includes(id))));
      await refresh();
    });
  }

  function handleBulkConfirm() {
    if (!bulkAction) return;
    const action = bulkAction;
    setBulkAction(null);
    runBulk(action, ticked);
  }

  const openDesign = () => {
    setDesignIds(ticked.filter((id) => all.some((qr) => qr.id === id && qr.status === "active")));
    setActiveStage("design");
  };

  const statusLabel = (status: QrDisplayStatus) => t(`status.${status}`);
  const statusBadge = (qr: QrCodeWithStatus) => {
    const status = getQrStatus(qr);
    return (
      <Badge variant={STATUS_VARIANT[status]} className="text-xs">
        {statusLabel(status)}
      </Badge>
    );
  };
  const name = (qr: QrCodeWithStatus) => qr.label ?? t("table.unlabelled");

  const batches = useMemo(() => {
    const map = new Map<string, NonNullable<QrCodeWithStatus["batch"]>>();
    for (const qr of all) if (qr.batch) map.set(qr.batch.id, qr.batch);
    return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [all]);
  const batchName = (batch: NonNullable<QrCodeWithStatus["batch"]>) =>
    batch.name ??
    t("registry.batchUnnamed", { date: new Date(batch.created_at).toLocaleDateString(locale) });
  const targetLabel = (type: string) => {
    const key = `targets.${type.replace(/\./g, "_")}`;
    return t.has(key) ? t(key) : type;
  };

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "status",
      label: t("table.statusHeader"),
      options: QR_STATUSES.map((value) => ({ value, label: t(`filters.${value}`) })),
    },
    {
      kind: "list",
      id: "nieuzywane",
      label: t("filters.unusedFor"),
      single: true,
      options: QR_UNUSED_DAYS.map((days) => ({
        value: days,
        label: t("filters.unusedDays", { days }),
      })),
    },
    ...(batches.length
      ? [
          {
            kind: "list" as const,
            id: "partia",
            label: t("filters.batch"),
            single: true,
            options: batches.map((batch) => ({ value: batch.id, label: batchName(batch) })),
          },
        ]
      : []),
  ];
  const order = ["label", ...layout.map((column) => column.id)];
  const sortOf = (field: QrState["sort"]) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const rowHref = (row: QrCodeWithStatus) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const date = (value: string) => (
    <span className="text-xs text-muted-foreground">
      {new Date(value).toLocaleDateString(locale)}
    </span>
  );
  const assignmentLink = (row: QrCodeWithStatus) =>
    row.assignment ? (
      // /qr/<token> resolves the target and opens its page (branch-aware).
      <a
        href={`/${locale}/qr/${encodeURIComponent(row.token)}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        onClick={(event) => event.stopPropagation()}
        title={t("targets.open")}
      >
        {targetLabel(row.assignment.target_type)}
        <ExternalLink className="size-3" />
      </a>
    ) : (
      <span className="text-xs text-muted-foreground">{t("table.unassignedDash")}</span>
    );
  const value = (row: QrCodeWithStatus, id: string) =>
    id === "token" ? (
      <span className="font-mono text-xs text-muted-foreground">{row.token.slice(0, 10)}…</span>
    ) : id === "status" ? (
      statusBadge(row)
    ) : id === "assignment" ? (
      assignmentLink(row)
    ) : id === "batch" ? (
      <span className="truncate text-xs text-muted-foreground">
        {row.batch ? batchName(row.batch) : t("registry.noBatch")}
      </span>
    ) : id === "last_scanned_at" ? (
      row.last_scanned_at ? (
        date(row.last_scanned_at)
      ) : (
        <span className="text-xs text-muted-foreground">{t("registry.neverScanned")}</span>
      )
    ) : id === "scan_count" ? (
      <span className="text-xs tabular-nums text-muted-foreground">{row.scan_count ?? 0}</span>
    ) : (
      date(row.created_at)
    );

  const tickedSet = new Set(ticked);
  const tickedOnPage = page.rows.filter((row) => tickedSet.has(row.id));
  const tickedRows = all.filter((qr) => tickedSet.has(qr.id));
  const tickedExpired = tickedRows.filter((qr) => qr.status === "expired").map((qr) => qr.id);
  const tickedPrintable = tickedRows.filter((qr) => qr.status === "active").map((qr) => qr.id);
  const selection =
    canExport || canRevoke
      ? {
          isSelected: (row: QrCodeWithStatus) => tickedSet.has(row.id),
          toggle: (row: QrCodeWithStatus) =>
            setTicked((now) =>
              now.includes(row.id) ? now.filter((id) => id !== row.id) : [...now, row.id]
            ),
          all: page.rows.length > 0 && tickedOnPage.length === page.rows.length,
          some: tickedOnPage.length > 0,
          toggleAll: () => {
            const onPage = page.rows.map((row) => row.id);
            setTicked((now) =>
              tickedOnPage.length === page.rows.length
                ? now.filter((id) => !onPage.includes(id))
                : [...new Set([...now, ...onPage])]
            );
          },
          allLabel: labels.selectAll,
          rowLabel: (row: QrCodeWithStatus) => labels.selectRow.replace("{name}", name(row)),
        }
      : undefined;

  const selected = all.find((qr) => qr.id === state.selected && !qr.deleted_at) ?? null;

  return (
    <TableNavigationProvider navigate={navigate}>
      <Tabs
        value={activeStage}
        onValueChange={(v) => setActiveStage(v as "select" | "design")}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
      >
        <TabsList className="grid w-[320px] max-w-full shrink-0 grid-cols-2">
          <TabsTrigger value="select">{t("stages.select")}</TabsTrigger>
          <TabsTrigger value="design" disabled={!canExport || designIds.length === 0}>
            {t("stages.design")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="select" className="!mt-0 flex min-h-0 min-w-0 flex-1 flex-col">
          <section className="dt-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{labels.title}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {page.totalCount}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => void refresh()}
                  disabled={codes.isFetching}
                  aria-label={t("refresh")}
                  title={t("refresh")}
                >
                  <RefreshCw className={`size-3.5 ${codes.isFetching ? "animate-spin" : ""}`} />
                </Button>
                {canRevoke ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setSettingsOpen(true)}
                    aria-label={t("registry.settings")}
                    title={t("registry.settings")}
                  >
                    <Settings2 className="size-3.5" />
                  </Button>
                ) : null}
                {canExport ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={tickedPrintable.length === 0}
                    onClick={openDesign}
                    title={ticked.length ? t("selection.designSelected") : t("selectHint")}
                  >
                    {ticked.length
                      ? t("selectedCount", { count: ticked.length })
                      : t("selection.designSelected")}
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                ) : null}
              </div>
            </header>
            {ticked.length > 0 && canRevoke ? (
              <div
                role="toolbar"
                aria-label={t("selectedCount", { count: ticked.length })}
                className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 md:px-4"
              >
                <span className="text-xs font-medium tabular-nums">
                  {t("selectedCount", { count: ticked.length })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => setTicked([])}
                  aria-label={t("registry.clearSelection")}
                  title={t("registry.clearSelection")}
                >
                  <X className="size-3.5" />
                </Button>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {tickedExpired.length ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={isBulkRunning}
                      onClick={() => runBulk("restore", tickedExpired)}
                    >
                      <RotateCcw className="mr-1.5 size-3.5" />
                      {t("registry.restoreSelected")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={isBulkRunning}
                    onClick={() => setBulkAction("revoke")}
                  >
                    <Ban className="mr-1.5 size-3.5" />
                    {t("registry.revokeSelected")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-destructive hover:text-destructive"
                    disabled={isBulkRunning}
                    onClick={() => setBulkAction("delete")}
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    {t("registry.deleteSelected")}
                  </Button>
                </div>
              </div>
            ) : null}
            {canCreate && allowGenerate ? (
              <div className="flex shrink-0 flex-wrap items-end gap-3 border-b px-3 py-2.5 md:px-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="qr-prefix" className="text-xs text-muted-foreground">
                    {t("generate.prefixLabel")}
                  </label>
                  <Input
                    id="qr-prefix"
                    value={labelPrefix}
                    onChange={(e) => setLabelPrefix(e.target.value)}
                    placeholder={t("generate.prefixPlaceholder")}
                    className="h-8 w-44"
                    disabled={isGenerating}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="qr-count" className="text-xs text-muted-foreground">
                    {t("generate.countLabel")}
                  </label>
                  <Input
                    id="qr-count"
                    type="number"
                    min={1}
                    max={50}
                    value={generateCount}
                    onChange={(e) =>
                      setGenerateCount(Math.min(50, Math.max(1, Number(e.target.value))))
                    }
                    className="h-8 w-24"
                    disabled={isGenerating}
                  />
                </div>
                <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
                  <Plus className="mr-1.5 size-3.5" />
                  {isGenerating ? t("generate.generating") : t("generate.submit")}
                </Button>
              </div>
            ) : null}
            <div className="dt-list-filter-row">
              <FilterBar
                parsers={qrParsers}
                fields={fields}
                resetOnChange={["strona", "selected"]}
                shallow
                pending={codes.isFetching}
                order={order}
                search={{ label: labels.search, placeholder: labels.search }}
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-1">
              <ListPane
                rows={page.rows}
                totalCount={page.totalCount}
                page={page.page}
                size={state.wierszy}
                sizes={QR_PAGE_SIZES}
                selected={state.selected}
                rowKey={(row) => row.id}
                rowHref={rowHref}
                pageHref={(strona) => href({ strona, selected: null })}
                sizeHref={(wierszy) =>
                  href({ wierszy: wierszy as QrState["wierszy"], strona: 1, selected: null })
                }
                set={set}
                layout={layout}
                widths={widths}
                cookie={cookie}
                onLayoutChange={setLayout}
                sortOf={(id) =>
                  id === "status" ||
                  id === "created_at" ||
                  id === "last_scanned_at" ||
                  id === "scan_count" ||
                  id === "batch"
                    ? sortOf(id)
                    : undefined
                }
                pinnedSort={sortOf("label")}
                identity={(row) => (
                  <>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                      <QrCode className="size-3.5 text-muted-foreground" />
                    </span>
                    <span
                      className={`block min-w-0 truncate text-[13px] ${row.label ? "font-medium" : "italic text-muted-foreground"}`}
                      title={name(row)}
                    >
                      {name(row)}
                    </span>
                  </>
                )}
                value={value}
                selection={selection}
                labels={labels}
                empty={state.q || state.status.length ? labels.empty : labels.emptyAll}
                error={codes.error ? codes.error.message : null}
                onRetry={() => void refresh()}
                onPreview={preview}
              />
              {state.selected ? (
                <ListSidePanel
                  titleId="qr-panel-title"
                  title={selected ? name(selected) : labels.notFound}
                  backLabel={labels.title}
                  closeLabel={labels.close}
                  onClose={() => preview(null)}
                  actions={
                    selected && canRevoke && selected.status === "expired" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runBulk("restore", [selected.id])}
                        disabled={isBulkRunning}
                      >
                        <RotateCcw className="mr-1.5 size-3.5" />
                        {t("registry.restoreButton")}
                      </Button>
                    ) : selected && canRevoke && selected.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRevokeTarget(selected.id)}
                        disabled={isRevoking}
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        {t("detail.revokeButton")}
                      </Button>
                    ) : null
                  }
                >
                  {selected ? (
                    <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
                      <div className="col-span-2">
                        <dt className="text-xs text-muted-foreground">{t("detail.token")}</dt>
                        <dd className="break-all font-mono text-xs">{selected.token}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("detail.status")}</dt>
                        <dd>{statusBadge(selected)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("detail.created")}</dt>
                        <dd>{new Date(selected.created_at).toLocaleString(locale)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("detail.assignment")}</dt>
                        <dd>{assignmentLink(selected)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("registry.lastScan")}</dt>
                        <dd>
                          {selected.last_scanned_at
                            ? new Date(selected.last_scanned_at).toLocaleString(locale)
                            : t("registry.neverScanned")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("registry.scanCount")}</dt>
                        <dd className="tabular-nums">{selected.scan_count ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("registry.batch")}</dt>
                        <dd>
                          {selected.batch ? batchName(selected.batch) : t("registry.noBatch")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("detail.id")}</dt>
                        <dd className="break-all font-mono text-xs text-muted-foreground">
                          {selected.id}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      {labels.notFound}
                    </p>
                  )}
                </ListSidePanel>
              ) : null}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="design" className="!mt-0 min-h-0 flex-1 overflow-hidden">
          {canExport && designIds.length > 0 ? (
            <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card p-4">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-sm font-medium">{t("design.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("design.description")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-[140px] grid-cols-2 rounded-lg border bg-muted p-1">
                    <Button
                      type="button"
                      variant={labelFormat === "pdf" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setLabelFormat("pdf")}
                    >
                      PDF
                    </Button>
                    <Button
                      type="button"
                      variant={labelFormat === "zpl" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setLabelFormat("zpl")}
                    >
                      ZPL
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setActiveStage("select")}
                    aria-label={t("design.backToSelection")}
                    title={t("design.backToSelection")}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden pt-4">
                <LabelDesigner
                  items={designIds.map((id) => ({ id, primaryText: "" }))}
                  canExport={canExport}
                  format={labelFormat}
                  availableFields={[
                    { key: PRIMARY_FIELD_KEY, label: tDesigner("fields.qrLabel") },
                    { key: TOKEN_FIELD_KEY, label: tDesigner("fields.qrToken") },
                    { key: SCAN_URL_FIELD_KEY, label: tDesigner("fields.scanUrl") },
                  ]}
                />
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!bulkAction} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "delete"
                ? t("registry.deleteTitle", { count: ticked.length })
                : t("registry.revokeTitle", { count: ticked.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "delete"
                ? t("registry.deleteDescription")
                : t("registry.revokeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("registry.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkAction === "delete"
                ? t("registry.confirmDelete", { count: ticked.length })
                : t("registry.confirmRevoke", { count: ticked.length })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canRevoke ? <QrSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} /> : null}

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("revokeDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("revokeDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("revokeDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableNavigationProvider>
  );
}
