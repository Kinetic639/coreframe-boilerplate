"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Plus, QrCode, RefreshCw, Trash2 } from "lucide-react";
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
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import {
  defaultLayout,
  type ColumnLayout,
  type ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import { ListPane, ListSidePanel } from "@/components/kolor-sensu/data-table/list-pane";
import { useListKeys } from "@/components/kolor-sensu/data-table/use-list-keys";
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { QR_CREATE, QR_REVOKE, QR_EXPORT } from "@/lib/constants/permissions";
import { listQrCodesAction } from "@/app/actions/qr/list";
import { createQrBatchAction } from "@/app/actions/qr/create-batch";
import { revokeQrAction } from "@/app/actions/qr/revoke";
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
  revoked: "destructive",
};

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
}: {
  orgId: string;
  initialCodes: QrCodeWithStatus[];
  /** The page the list's links lead to (its own address). */
  path: string;
  layout?: ColumnLayout;
  widths?: ColumnWidths;
  cookie: string;
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

  const openDesign = () => {
    setDesignIds(ticked);
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

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "status",
      label: t("table.statusHeader"),
      options: QR_STATUSES.map((value) => ({ value, label: t(`filters.${value}`) })),
    },
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
  const value = (row: QrCodeWithStatus, id: string) =>
    id === "token" ? (
      <span className="font-mono text-xs text-muted-foreground">{row.token.slice(0, 10)}…</span>
    ) : id === "status" ? (
      statusBadge(row)
    ) : id === "assignment" ? (
      <span className="text-xs text-muted-foreground">
        {row.assignment ? row.assignment.target_type : t("table.unassignedDash")}
      </span>
    ) : (
      date(row.created_at)
    );

  const tickedSet = new Set(ticked);
  const tickedOnPage = page.rows.filter((row) => tickedSet.has(row.id));
  const selection = canExport
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
          <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
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
                {canExport ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ticked.length === 0}
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
            {canCreate ? (
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
            <div className="ks-list-filter-row">
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
                  id === "status"
                    ? sortOf("status")
                    : id === "created_at"
                      ? sortOf("created_at")
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
                    selected && canRevoke && selected.status === "active" ? (
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
                        <dd>
                          {selected.assignment ? (
                            selected.assignment.target_type
                          ) : (
                            <span className="text-muted-foreground">{t("detail.unassigned")}</span>
                          )}
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
