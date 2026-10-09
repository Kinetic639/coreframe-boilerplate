"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Copy,
  CornerDownLeft,
  ExternalLink,
  History,
  Loader2,
  Package,
} from "lucide-react";
import { getSearchPreviewAction } from "@/app/actions/global-search";
import type { SearchExactHit, SearchPreview } from "@/server/services/global-search.service";

type GlobalSearchTranslator = ReturnType<typeof useTranslations<"globalSearch">>;

export interface PreviewLink {
  href: string;
  query?: Record<string, string>;
}

interface GlobalSearchPreviewProps {
  hit: SearchExactHit;
  /** Second line of the result row (type, stock, warehouse, …) */
  details: string;
  statusLabel: (status: string) => string;
  onOpen: () => void;
  onOpenNewTab: () => void;
  onCopy: () => void;
  onNavigate: (link: PreviewLink) => void;
  /** ArrowLeft from the actions returns to the search input */
  onBack: () => void;
}

/** A repair order opened on one of its warehouse tabs, scrolled to that section */
export function repairOrderTabHref(id: string, tab: "receiving" | "stock"): string {
  return `/dashboard/workshop/${id}?tab=${tab}#warehouse`;
}

const PREVIEW_TYPES = new Set<SearchExactHit["type"]>(["item", "repairOrder"]);

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function ItemPreview({
  data,
  t,
  onNavigate,
}: {
  data: Extract<SearchPreview, { type: "item" }>;
  t: GlobalSearchTranslator;
  onNavigate: (link: PreviewLink) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("preview.onHand")} value={formatNumber(data.onHand)} />
        <Stat label={t("preview.committed")} value={formatNumber(data.committed)} />
        <Stat label={t("preview.available")} value={formatNumber(data.available)} />
      </div>
      <div>
        <SectionTitle>{t("preview.locations")}</SectionTitle>
        {data.locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("preview.noStock")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.locations.map((location, index) => (
              <li key={`${location.code}-${index}`} className="flex justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  {location.code ? <span className="font-mono">{location.code}</span> : null}
                  {location.code && location.name ? " · " : null}
                  {location.name}
                </span>
                <span className="shrink-0 tabular-nums">{formatNumber(location.onHand)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <SectionTitle>{t("preview.openOrders")}</SectionTitle>
        {data.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("preview.noOrders")}</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {data.orders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onNavigate({ href: `/dashboard/workshop/${order.id}` })}
                  className="flex w-full justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono">{order.code ?? "—"}</span>
                    {order.client ? ` · ${order.client}` : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatNumber(order.quantity)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function RepairOrderPreview({
  data,
  t,
  statusLabel,
}: {
  data: Extract<SearchPreview, { type: "repairOrder" }>;
  t: GlobalSearchTranslator;
  statusLabel: (status: string) => string;
}) {
  const facts: [string, string | null][] = [
    [t("preview.client"), data.client],
    [t("preview.vehicle"), data.vehicleBrand],
    [t("preview.vin"), data.vin],
    [t("preview.warehouse"), data.warehouseCode],
    [t("preview.status"), statusLabel(data.status)],
  ];
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate">{value}</dd>
            </div>
          ))}
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t("preview.lines")} value={String(data.lineCount)} />
        <Stat label={t("preview.linkedLines")} value={String(data.linkedLineCount)} />
      </div>
      {data.lines.length > 0 ? (
        <div>
          <SectionTitle>{t("preview.firstLines")}</SectionTitle>
          <ul className="divide-y text-sm">
            {data.lines.map((line, index) => (
              <li key={`${line.code}-${index}`} className="flex justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  {line.code ? <span className="font-mono">{line.code}</span> : null}
                  {line.code && line.name ? " · " : null}
                  {line.name}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatNumber(line.quantity)} {line.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  shortcut,
  primary,
  onClick,
  onBack,
}: {
  icon: typeof Copy;
  label: string;
  shortcut?: string;
  primary?: boolean;
  onClick: () => void;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onBack();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const buttons = [
            ...(event.currentTarget.parentElement?.querySelectorAll("button") ?? []),
          ] as HTMLButtonElement[];
          const index = buttons.indexOf(event.currentTarget);
          buttons[
            (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
          ]?.focus();
        }
      }}
      className={
        primary
          ? "flex h-9 items-center justify-between gap-2 rounded-md bg-foreground px-3 text-sm text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          : "flex h-9 items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4" />
        {label}
      </span>
      {shortcut ? <span className="font-mono text-[11px] opacity-70">{shortcut}</span> : null}
    </button>
  );
}

/**
 * Right-hand preview of the highlighted search result (desktop only): stock and
 * open orders of a part, header and first lines of a repair order, and the
 * actions on the result. → from the input moves into the actions, ← returns.
 */
export const GlobalSearchPreview = forwardRef<HTMLDivElement, GlobalSearchPreviewProps>(
  function GlobalSearchPreview(
    { hit, details, statusLabel, onOpen, onOpenNewTab, onCopy, onNavigate, onBack },
    actionsRef
  ) {
    const t = useTranslations("globalSearch");
    const previewType = PREVIEW_TYPES.has(hit.type) ? (hit.type as SearchPreview["type"]) : null;

    const preview = useQuery({
      queryKey: ["global-search", "preview", previewType, hit.id],
      queryFn: async () => {
        const result = await getSearchPreviewAction(previewType!, hit.id);
        return result.success ? result.data : null;
      },
      enabled: previewType !== null,
      staleTime: 30_000,
    });

    const data = preview.data;
    const firstSku = data?.type === "item" ? data.skus[0] : undefined;

    return (
      <aside
        aria-label={t("preview.title")}
        className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-muted/30 p-4 lg:flex"
      >
        <div>
          <div className="text-xs text-muted-foreground">{t(`hitTypes.${hit.type}`)}</div>
          {hit.code ? (
            <div className="break-all font-mono text-lg font-semibold">{hit.code}</div>
          ) : null}
          {hit.title ? <div className="text-sm">{hit.title}</div> : null}
          {details ? <div className="mt-1 text-xs text-muted-foreground">{details}</div> : null}
        </div>

        {previewType && preview.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("preview.loading")}
          </div>
        ) : null}
        {data?.type === "item" ? <ItemPreview data={data} t={t} onNavigate={onNavigate} /> : null}
        {data?.type === "repairOrder" ? (
          <RepairOrderPreview data={data} t={t} statusLabel={statusLabel} />
        ) : null}

        <div
          ref={actionsRef}
          className="mt-auto flex flex-col gap-1.5"
          role="group"
          aria-label={t("preview.actions")}
        >
          <ActionButton
            icon={CornerDownLeft}
            label={t("preview.open")}
            shortcut="↵"
            primary
            onClick={onOpen}
            onBack={onBack}
          />
          <ActionButton
            icon={ExternalLink}
            label={t("preview.openNewTab")}
            shortcut="Ctrl ↵"
            onClick={onOpenNewTab}
            onBack={onBack}
          />
          {hit.code ? (
            <ActionButton
              icon={Copy}
              label={t("preview.copy")}
              shortcut="Ctrl ⇧ C"
              onClick={onCopy}
              onBack={onBack}
            />
          ) : null}
          {hit.type === "repairOrder" ? (
            <>
              <ActionButton
                icon={ArrowDownToLine}
                label={t("preview.tabReceiving")}
                onClick={() => onNavigate({ href: repairOrderTabHref(hit.id, "receiving") })}
                onBack={onBack}
              />
              <ActionButton
                icon={Package}
                label={t("preview.tabStock")}
                onClick={() => onNavigate({ href: repairOrderTabHref(hit.id, "stock") })}
                onBack={onBack}
              />
            </>
          ) : null}
          {firstSku ? (
            <ActionButton
              icon={History}
              label={t("preview.movements")}
              onClick={() =>
                onNavigate({
                  href: "/dashboard/warehouse/inventory/movements",
                  query: { search: firstSku },
                })
              }
              onBack={onBack}
            />
          ) : null}
        </div>
      </aside>
    );
  }
);
