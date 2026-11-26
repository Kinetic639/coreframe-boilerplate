"use client";

import { Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { REQUEST_FILTERS, type RequestFilter, type TicketTypeRef } from "@/server/requests/types";

export type ListScope = "mine" | "branch";

type ToolbarProps = {
  scope: ListScope;
  filter: RequestFilter;
  typeId: string | null;
  search: string;
  yourTurn: number;
  types: TicketTypeRef[];
  pending: boolean;
  /** Narrow list next to the request panel: search goes to its own row. */
  compact: boolean;
  onScope: (scope: ListScope) => void;
  onFilter: (filter: RequestFilter) => void;
  onType: (typeId: string | null) => void;
  onSearch: (text: string) => void;
};

/** Segmented control as in Ambra (muted track, the active option raised). */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex h-10 shrink-0 items-center rounded-md bg-muted p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value && "bg-background text-foreground shadow-sm"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-100 px-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
      {count}
    </span>
  );
}

function SearchField({
  value,
  pending,
  onChange,
  className,
}: {
  value: string;
  pending: boolean;
  onChange: (v: string) => void;
  className?: string;
}) {
  const t = useTranslations("requests");
  return (
    <label
      role="search"
      className={cn(
        "flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="sr-only">{t("search")}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function TypeSelect({
  types,
  typeId,
  onType,
  className,
  short = false,
}: {
  types: TicketTypeRef[];
  typeId: string | null;
  onType: (id: string | null) => void;
  className?: string;
  short?: boolean;
}) {
  const t = useTranslations("requests");
  if (types.length === 0) return null;
  return (
    <Select value={typeId ?? "all"} onValueChange={(v) => onType(v === "all" ? null : v)}>
      <SelectTrigger aria-label={t("type")} className={cn("h-10", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">{short ? t("type") : t("allTypes")}</SelectItem>
        {types.map((type) => (
          <SelectItem key={type.id} value={type.id}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: type.color }}
              />
              {type.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Desktop: scope and status as segmented controls, type select and search. */
export function DesktopToolbar(p: ToolbarProps) {
  const t = useTranslations("requests");
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
      <Segmented
        label={t("scope.label")}
        value={p.scope}
        onChange={p.onScope}
        options={(["mine", "branch"] as const).map((s) => ({ value: s, label: t(`scope.${s}`) }))}
      />
      <div className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none]">
        <Segmented
          label={t("filter.label")}
          value={p.filter}
          onChange={p.onFilter}
          options={REQUEST_FILTERS.map((f) => ({
            value: f,
            label: (
              <>
                {t(`filter.${f}`)}
                {f === "yourTurn" && <CountBadge count={p.yourTurn} />}
              </>
            ),
          }))}
        />
      </div>
      <div className={cn("flex items-center gap-3", p.compact ? "w-full" : "ml-auto")}>
        <TypeSelect
          types={p.types}
          typeId={p.typeId}
          onType={p.onType}
          className={p.compact ? "w-44 shrink-0" : "w-52"}
        />
        <SearchField
          value={p.search}
          pending={p.pending}
          onChange={p.onSearch}
          className={p.compact ? "flex-1" : "w-72"}
        />
      </div>
    </div>
  );
}

/** Phone: search, scope + type, status chips that scroll sideways. */
export function MobileToolbar(p: ToolbarProps) {
  const t = useTranslations("requests");
  return (
    <div className="flex flex-col gap-3 border-b bg-background px-4 pb-3 pt-3">
      <SearchField value={p.search} pending={p.pending} onChange={p.onSearch} />
      <div className="flex gap-2">
        <Segmented
          label={t("scope.label")}
          value={p.scope}
          onChange={p.onScope}
          className="grid flex-1 grid-cols-2"
          options={(["mine", "branch"] as const).map((s) => ({
            value: s,
            label: t(`scope.${s}`),
          }))}
        />
        <TypeSelect
          types={p.types}
          typeId={p.typeId}
          onType={p.onType}
          className="w-[38%] shrink-0"
          short
        />
      </div>
      <div
        role="radiogroup"
        aria-label={t("filter.label")}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
      >
        {REQUEST_FILTERS.map((f) => {
          const active = p.filter === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => p.onFilter(f)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : f === "yourTurn" && p.yourTurn > 0
                    ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300"
                    : "bg-background text-foreground"
              )}
            >
              {t(`filter.${f}`)}
              {f === "yourTurn" && p.yourTurn > 0 && <span>· {p.yourTurn}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
