"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  Building2,
  Car,
  CheckSquare,
  CornerDownLeft,
  History,
  FileText,
  MapPin,
  Package,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { getPathname, usePathname, useRouter } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { getIconComponent } from "@/lib/sidebar/v2/icon-map";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { signOutAction } from "@/app/[locale]/actions";
import { cn } from "@/lib/utils";
import {
  ACTIONS_PREFIX,
  buildPaletteGroups,
  parsePaletteQuery,
  withPalettePrefix,
  type PaletteItem,
} from "@/lib/global-search/palette";
import { highlightRanges } from "@/lib/global-search/match";
import {
  pushRecentSearch,
  readRecentSearches,
  type RecentSearchItem,
} from "@/lib/global-search/recent";
import { SEARCH_SCOPES, type SearchSourceId } from "@/lib/global-search/sources";
import type { SearchEntry } from "@/lib/global-search/types";
import { useDebounce } from "@/hooks/use-debounce";
import { globalSearchAction, type GlobalSearchResult } from "@/app/actions/global-search";
import type { ExactHitType, SearchExactHit } from "@/server/services/global-search.service";
import { useGlobalSearchStore } from "./global-search-store";
import { GlobalSearchPreview } from "./global-search-preview";

// Same landing route as the sidebar branch switcher: branch-neutral, never 404s.
const SAFE_ROUTE_AFTER_BRANCH_SWITCH = "/dashboard/start";
const BRANCH_ITEM_PREFIX = "branch:";
const HIT_ITEM_PREFIX = "hit:";
const SEARCH_DEBOUNCE_MS = 200;
const MIN_DATA_QUERY = 3;
const EMPTY_RESULT: GlobalSearchResult = { exact: [], results: [], otherBranches: [] };
/** Rows per data group from the server; a full group gets a "show all" row */
const DATA_GROUP_LIMIT = 5;
const SHOW_ALL_PREFIX = "all:";
const PREVIEW_DEBOUNCE_MS = 120;

/** Module list a data group's "show all" opens, with the query as its search */
const SHOW_ALL_LISTS: Partial<Record<ExactHitType, { href: string; param: string }>> = {
  repairOrder: { href: "/dashboard/workshop", param: "q" },
  item: { href: "/dashboard/warehouse/items", param: "search" },
  location: { href: "/dashboard/warehouse/locations", param: "search" },
  document: { href: "/dashboard/warehouse/inventory/movements", param: "search" },
  ticket: { href: "/dashboard/help-desk/tickets", param: "search" },
  task: { href: "/dashboard/planning/tasks", param: "search" },
  person: { href: "/dashboard/organization/users/members", param: "search" },
};

const HIT_ICONS: Record<ExactHitType, LucideIcon> = {
  repairOrder: Car,
  ticket: Ticket,
  task: CheckSquare,
  document: FileText,
  container: Boxes,
  location: MapPin,
  item: Package,
  person: UserRound,
};

/** Order of the data groups below the pages and actions */
const DATA_GROUP_ORDER: ExactHitType[] = [
  "repairOrder",
  "item",
  "container",
  "location",
  "document",
  "ticket",
  "task",
  "person",
];

type Target =
  | { type: "entry"; entry: SearchEntry }
  | { type: "branch"; branchId: string; name: string }
  | { type: "hit"; hit: SearchExactHit }
  | { type: "recent"; item: RecentSearchItem }
  | { type: "link"; href: string; query?: Record<string, string> };

const RECENT_ITEM_PREFIX = "recent:";

function hitItemId(hit: SearchExactHit): string {
  return `${HIT_ITEM_PREFIX}${hit.type}:${hit.id}`;
}

function recentItemId(item: RecentSearchItem): string {
  return `${RECENT_ITEM_PREFIX}${item.id}`;
}

function routeHref(href: string, query?: Record<string, string>) {
  const pathname = toUnsafeI18nHref(href);
  return query ? { pathname, query } : pathname;
}

function hitHref(hit: SearchExactHit) {
  return routeHref(hit.href, hit.query);
}

function recentHref(item: RecentSearchItem) {
  return routeHref(item.href, item.query);
}

function recentIcon(
  item: RecentSearchItem
): LucideIcon | React.ComponentType<{ className?: string }> {
  if (item.kind === "hit" && item.icon in HIT_ICONS) return HIT_ICONS[item.icon as ExactHitType];
  return item.kind === "page" ? getIconComponent(item.icon) : History;
}

/** Text with the query words highlighted */
function Highlighted({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={index}
        className="rounded-sm bg-amber-200/70 px-0 text-inherit dark:bg-amber-400/30"
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

interface GlobalSearchDialogProps {
  /** Server-resolved pages and actions the user may open */
  entries: SearchEntry[];
  /** Data sources the user may search (scope chips and prefixes) */
  sources?: SearchSourceId[];
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function ScopeChip({
  active,
  hint,
  onClick,
  children,
}: {
  active: boolean;
  hint?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "bg-background text-foreground hover:bg-accent"
      )}
    >
      {children}
      {hint ? (
        <span
          className={cn(
            "font-mono text-[11px]",
            active ? "text-background/70" : "text-muted-foreground"
          )}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}

type GlobalSearchTranslator = ReturnType<typeof useTranslations<"globalSearch">>;

/** Second line of a data row: stock, warehouse, matched part, location, date, e-mail */
function hitDetails(hit: SearchExactHit, t: GlobalSearchTranslator, withType: boolean): string {
  const meta = hit.meta ?? {};
  const parts: (string | null | undefined)[] = [withType ? t(`hitTypes.${hit.type}`) : null];
  switch (hit.type) {
    case "repairOrder":
      if (meta.warehouseCode) parts.push(t("details.warehouse", { code: meta.warehouseCode }));
      if (meta.vin) parts.push(String(meta.vin));
      if (meta.matchedPart) parts.push(t("details.containsPart", { code: meta.matchedPart }));
      break;
    case "item":
      if (meta.onHand !== undefined) {
        parts.push(
          t("details.stock", { onHand: meta.onHand, available: meta.available ?? meta.onHand })
        );
      } else {
        parts.push(t("details.noStock"));
      }
      break;
    case "container":
      if (meta.locationCode) parts.push(t("details.location", { code: meta.locationCode }));
      break;
    case "document":
      parts.push(meta.documentType ? String(meta.documentType) : null);
      parts.push(meta.date ? String(meta.date) : null);
      break;
    case "person":
      parts.push(meta.email ? String(meta.email) : null);
      break;
  }
  parts.push(hit.subtitle);
  return parts.filter(Boolean).join(" · ");
}

interface HitRowProps {
  hit: SearchExactHit;
  exact: boolean;
  onSelect: (value: string) => void;
  t: GlobalSearchTranslator;
  statusLabel: (status: string) => string;
  /** Query text (without the mode prefix) to highlight */
  query: string;
}

function HitRow({ hit, exact, onSelect, t, statusLabel, query }: HitRowProps) {
  const Icon = HIT_ICONS[hit.type];
  const details = hitDetails(hit, t, exact);
  return (
    <CommandItem
      value={hitItemId(hit)}
      onSelect={onSelect}
      className={
        exact
          ? "group gap-3 rounded-lg border border-transparent px-2 py-2.5 data-[selected=true]:border-primary/40 data-[selected=true]:bg-primary/10"
          : "group gap-3 rounded-lg px-2 py-2.5 data-[selected=true]:bg-primary/10"
      }
    >
      <span
        className={
          exact
            ? "flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
            : "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[selected=true]:bg-background group-data-[selected=true]:text-primary"
        }
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {hit.code ? (
            <span className="font-mono">
              <Highlighted text={hit.code} query={query} />
            </span>
          ) : null}
          {hit.code && hit.title ? " · " : null}
          {hit.title ? <Highlighted text={hit.title} query={query} /> : null}
        </span>
        {details ? (
          <span className="block truncate text-xs text-muted-foreground">{details}</span>
        ) : null}
      </span>
      {hit.status ? (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {statusLabel(hit.status)}
        </span>
      ) : null}
      <CornerDownLeft className="hidden size-4 text-muted-foreground group-data-[selected=true]:block" />
    </CommandItem>
  );
}

/**
 * Global search palette (Ctrl+K / ⌘K).
 *
 * Mounted once in the dashboard header. Lists pages and actions resolved
 * server-side; `>` switches to the actions mode. Enter opens, Ctrl+Enter opens
 * a page in a new tab, Esc closes (focus returns to where it was).
 */
export function GlobalSearchDialog({ entries, sources = [] }: GlobalSearchDialogProps) {
  const t = useTranslations("globalSearch");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { resolvedTheme, setTheme } = useTheme();
  const setStoreTheme = useUiStoreV2((s) => s.setTheme);
  const { accessibleBranches, activeBranchId, activeOrgId, setActiveBranch } = useAppStoreV2();
  const userId = useUserStoreV2((s) => s.user?.id ?? null);
  const { open, initialQuery, setOpen, toggle } = useGlobalSearchStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [recent, setRecent] = useState<RecentSearchItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && userId && activeOrgId) setRecent(readRecentSearches(userId, activeOrgId));
  }, [open, userId, activeOrgId]);

  const remember = useCallback(
    (item: RecentSearchItem) => {
      if (userId && activeOrgId) setRecent(pushRecentSearch(userId, activeOrgId, item));
    },
    [userId, activeOrgId]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  const label = useCallback(
    (key: string | undefined, fallback: string | undefined) =>
      key && tRoot.has(key) ? tRoot(key) : (fallback ?? ""),
    [tRoot]
  );

  const { items, targets } = useMemo(() => {
    const targetMap = new Map<string, Target>();
    const list: PaletteItem[] = [];

    for (const entry of entries) {
      const parent = label(entry.parentTitleKey, entry.parentTitle);
      list.push({
        id: entry.id,
        kind: entry.kind,
        section: entry.section,
        label: label(entry.titleKey, entry.title),
        subtitle: parent || undefined,
        keywords: entry.keywords,
      });
      targetMap.set(entry.id, { type: "entry", entry });
    }

    for (const branch of accessibleBranches) {
      if (branch.id === activeBranchId) continue;
      const id = `${BRANCH_ITEM_PREFIX}${branch.id}`;
      list.push({
        id,
        kind: "action",
        section: "general",
        label: t("switchBranch", { name: branch.name }),
        keywords: ["oddzial", "zmien oddzial", "przelacz", "branch", "switch branch", branch.name],
      });
      targetMap.set(id, { type: "branch", branchId: branch.id, name: branch.name });
    }

    return { items: list, targets: targetMap };
  }, [entries, accessibleBranches, activeBranchId, label, t]);

  const groups = useMemo(() => buildPaletteGroups(query, items, sources), [query, items, sources]);
  const parsed = parsePaletteQuery(query, sources);
  const { actionsMode } = parsed;
  const isEmptyQuery = !parsed.prefix && !parsed.text;

  // Data: exact hits for a recognized identifier (ZL, VIN, HD-, PZ/…, code) and
  // fragment matches across orders, parts, locations, … — one server call
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const debounced = parsePaletteQuery(debouncedQuery, sources);
  const dataText = debounced.actionsMode ? "" : debounced.text;
  const dataEnabled =
    open && !actionsMode && sources.length > 0 && dataText.length >= MIN_DATA_QUERY;
  const dataQuery = useQuery({
    queryKey: ["global-search", "data", activeBranchId, debounced.scope ?? "all", dataText],
    queryFn: async () => {
      const result = await globalSearchAction(dataText, debounced.scope);
      return result.success ? result.data : EMPTY_RESULT;
    },
    enabled: dataEnabled,
    staleTime: 30_000,
    // Keep the previous results on screen while the next query loads
    placeholderData: (previous) => previous,
  });
  const showData = dataEnabled && parsed.text.length >= MIN_DATA_QUERY;
  const data = showData ? (dataQuery.data ?? EMPTY_RESULT) : EMPTY_RESULT;
  const exactHits = data.exact;
  const dataLoading = dataEnabled && dataQuery.isFetching;

  const dataGroups = useMemo(
    () =>
      DATA_GROUP_ORDER.map((type) => {
        const hits = data.results.filter((hit) => hit.type === type);
        const list = SHOW_ALL_LISTS[type];
        // A full group probably has more: link to the module list with the query
        const showAll =
          list && hits.length >= DATA_GROUP_LIMIT
            ? {
                id: `${SHOW_ALL_PREFIX}${type}`,
                href: list.href,
                query: { [list.param]: dataText },
              }
            : null;
        return { type, hits, showAll };
      }).filter((group) => group.hits.length > 0),
    [data.results, dataText]
  );

  // Recently opened: shown for an empty query only
  const recentItems = useMemo(() => (isEmptyQuery ? recent : []), [isEmptyQuery, recent]);

  const allTargets = useMemo(() => {
    const map = new Map(targets);
    for (const hit of [...exactHits, ...data.results]) {
      map.set(hitItemId(hit), { type: "hit", hit });
    }
    for (const item of recentItems) map.set(recentItemId(item), { type: "recent", item });
    for (const group of dataGroups) {
      if (group.showAll) {
        map.set(group.showAll.id, {
          type: "link",
          href: group.showAll.href,
          query: group.showAll.query,
        });
      }
    }
    return map;
  }, [data.results, dataGroups, exactHits, recentItems, targets]);

  // Preview pane follows the highlighted data result (debounced: ↑↓ moves fast)
  const previewSelected = useDebounce(selected, PREVIEW_DEBOUNCE_MS);
  const previewTarget = allTargets.get(previewSelected);
  const previewHit = previewTarget?.type === "hit" ? previewTarget.hit : null;
  const actionsRef = useRef<HTMLDivElement>(null);

  // Other branches: matches the user can open after switching branch
  const otherBranches = useMemo(
    () =>
      data.otherBranches
        .map((row) => ({
          ...row,
          name: accessibleBranches.find((branch) => branch.id === row.branchId)?.name,
        }))
        .filter((row): row is typeof row & { name: string } => Boolean(row.name)),
    [accessibleBranches, data.otherBranches]
  );

  const statusLabel = useCallback(
    (status: string) =>
      tRoot.has(`globalSearch.statuses.${status}`) ? t(`statuses.${status}`) : status,
    [t, tRoot]
  );

  // A pasted number should open its object on Enter: highlight the first exact hit
  const firstHitId = exactHits[0] ? hitItemId(exactHits[0]) : null;
  useEffect(() => {
    if (firstHitId) setSelected(firstHitId);
  }, [firstHitId]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const switchBranch = useCallback(
    (branchId: string, name: string) => {
      startTransition(async () => {
        try {
          const result = await changeBranch(branchId);
          if (!result.success) {
            toast.error("error" in result ? result.error : t("branchSwitchFailed"));
            return;
          }
          setActiveBranch(branchId);
          toast.success(t("branchSwitched", { name }));
          close();
          router.replace(SAFE_ROUTE_AFTER_BRANCH_SWITCH);
          router.refresh();
        } catch {
          toast.error(t("branchSwitchFailed"));
        }
      });
    },
    [close, router, setActiveBranch, t]
  );

  const runEntry = useCallback(
    (entry: SearchEntry) => {
      switch (entry.command) {
        case "theme.toggle": {
          const next = resolvedTheme === "dark" ? "light" : "dark";
          setTheme(next);
          setStoreTheme(next);
          close();
          return;
        }
        case "locale.toggle": {
          close();
          router.replace(
            // @ts-expect-error -- pathname and params come from the current route
            { pathname, params },
            { locale: locale === "pl" ? "en" : "pl" }
          );
          return;
        }
        case "auth.signOut":
          close();
          startTransition(() => signOutAction());
          return;
        default:
          if (entry.href) {
            close();
            router.push(toUnsafeI18nHref(entry.href));
          }
      }
    },
    [close, locale, params, pathname, resolvedTheme, router, setStoreTheme, setTheme]
  );

  /** What "recently opened" keeps for a target (pages and data; not commands) */
  const recentFor = useCallback(
    (target: Target): RecentSearchItem | null => {
      if (target.type === "recent") return target.item;
      if (target.type === "hit") {
        return {
          id: hitItemId(target.hit),
          kind: "hit",
          label: target.hit.title ?? "",
          code: target.hit.code,
          subtitle: t(`hitTypes.${target.hit.type}`),
          icon: target.hit.type,
          href: target.hit.href,
          query: target.hit.query,
        };
      }
      if (target.type === "entry" && target.entry.kind === "page" && target.entry.href) {
        const parent = label(target.entry.parentTitleKey, target.entry.parentTitle);
        return {
          id: target.entry.id,
          kind: "page",
          label: label(target.entry.titleKey, target.entry.title),
          subtitle: parent || undefined,
          icon: target.entry.iconKey,
          href: target.entry.href,
        };
      }
      return null;
    },
    [label, t]
  );

  const select = useCallback(
    (id: string) => {
      const target = allTargets.get(id);
      if (!target) return;
      const recentItem = recentFor(target);
      if (recentItem) remember(recentItem);
      if (target.type === "branch") switchBranch(target.branchId, target.name);
      else if (target.type === "hit" || target.type === "recent") {
        close();
        router.push(target.type === "hit" ? hitHref(target.hit) : recentHref(target.item));
      } else if (target.type === "link") {
        close();
        router.push(routeHref(target.href, target.query));
      } else runEntry(target.entry);
    },
    [allTargets, close, recentFor, remember, router, runEntry, switchBranch]
  );

  const openInNewTab = useCallback(
    (id: string) => {
      const target = allTargets.get(id);
      let href;
      if (target?.type === "hit") href = hitHref(target.hit);
      else if (target?.type === "recent") href = recentHref(target.item);
      else if (target?.type === "link") href = routeHref(target.href, target.query);
      else if (target?.type === "entry" && target.entry.href && !target.entry.command)
        href = toUnsafeI18nHref(target.entry.href);
      if (!href || !target) return false;
      const recentItem = recentFor(target);
      if (recentItem) remember(recentItem);
      window.open(getPathname({ href, locale }), "_blank", "noopener");
      close();
      return true;
    },
    [allTargets, close, locale, recentFor, remember]
  );

  const applyPrefix = useCallback(
    (prefix: string | null) => {
      setQuery(withPalettePrefix(query, prefix));
      inputRef.current?.focus();
    },
    [query]
  );

  const copyCode = useCallback(
    (hit: SearchExactHit) => {
      if (!hit.code) return;
      navigator.clipboard
        ?.writeText(hit.code)
        .then(() => toast.success(t("copied", { code: hit.code ?? "" })))
        .catch(() => toast.error(t("copyFailed")));
    },
    [t]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && selected) {
      if (openInNewTab(selected)) event.preventDefault();
    }
    const selectedTarget = allTargets.get(selected);
    const selectedHit = selectedTarget?.type === "hit" ? selectedTarget.hit : null;
    // Ctrl+Shift+C copies the highlighted result's number
    if (
      selectedHit &&
      event.key.toLowerCase() === "c" &&
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey
    ) {
      event.preventDefault();
      copyCode(selectedHit);
    }
    // → at the end of the input moves into the preview actions
    const input = inputRef.current;
    if (
      event.key === "ArrowRight" &&
      selectedHit &&
      input &&
      event.target === input &&
      input.selectionStart === input.value.length
    ) {
      const firstAction = actionsRef.current?.querySelector("button");
      if (firstAction && firstAction.offsetParent !== null) {
        event.preventDefault();
        firstAction.focus();
      }
    }
    // Backspace on a bare prefix (">", "zl: ") leaves the mode
    if (event.key === "Backspace" && parsed.prefix && !parsed.text) {
      event.preventDefault();
      setQuery("");
    }
  };

  const modeBadge = parsed.actionsMode
    ? t("actionsModeBadge")
    : parsed.scope
      ? `${parsed.prefix} ${t(`scopes.${parsed.scope}`)}`
      : null;

  const groupHeading = (id: string) =>
    t.has(`groups.${id}`) ? t(`groups.${id}`) : t(`sections.${id}`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideClose
        className="top-0 flex h-dvh max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:top-[12vh] sm:h-auto sm:max-h-[76vh] sm:max-w-2xl sm:rounded-xl lg:max-w-4xl"
      >
        <VisuallyHidden>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </VisuallyHidden>
        <Command
          shouldFilter={false}
          value={selected}
          onValueChange={setSelected}
          onKeyDown={onKeyDown}
          className="flex min-h-0 flex-1 flex-col [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <div className="flex items-center border-b pr-3 [&_[data-cmdk-input-wrapper]]:border-0">
            {modeBadge ? (
              <span className="ml-3 shrink-0 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                {modeBadge}
              </span>
            ) : null}
            <div className="flex-1">
              <CommandInput
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder={
                  actionsMode
                    ? t("actionsPlaceholder")
                    : parsed.scope
                      ? t("scopePlaceholder", { scope: t(`scopes.${parsed.scope}`) })
                      : t("placeholder")
                }
                aria-label={t("dialogTitle")}
                className="h-14 text-base"
              />
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 text-sm text-primary sm:hidden"
            >
              {t("cancel")}
            </button>
          </div>

          {/* Scope chips: same as typing the prefix */}
          <div
            role="toolbar"
            aria-label={t("scopesLabel")}
            className="flex gap-1.5 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none]"
          >
            <ScopeChip active={!parsed.prefix} onClick={() => applyPrefix(null)}>
              {t("scopeAll")}
            </ScopeChip>
            {SEARCH_SCOPES.filter((scope) => sources.includes(scope.source)).map((scope) => (
              <ScopeChip
                key={scope.source}
                active={parsed.scope === scope.source}
                hint={scope.prefix}
                onClick={() => applyPrefix(scope.prefix)}
              >
                {t(`scopes.${scope.source}`)}
              </ScopeChip>
            ))}
            <ScopeChip
              active={actionsMode}
              hint={ACTIONS_PREFIX}
              onClick={() => applyPrefix(ACTIONS_PREFIX)}
            >
              {t("scopeActions")}
            </ScopeChip>
          </div>

          <div className="flex min-h-0 flex-1">
            <CommandList className="!max-h-none min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-2 sm:!max-h-[60vh]">
              <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
                {dataLoading
                  ? t("searching")
                  : parsed.scope && parsed.text.length < MIN_DATA_QUERY
                    ? t("typeMore")
                    : t("empty")}
              </CommandEmpty>
              {recentItems.length > 0 ? (
                <CommandGroup heading={t("groups.recent")}>
                  {recentItems.map((item) => {
                    const Icon = recentIcon(item);
                    return (
                      <CommandItem
                        key={recentItemId(item)}
                        value={recentItemId(item)}
                        onSelect={select}
                        className="group gap-3 rounded-lg px-2 py-2.5 data-[selected=true]:bg-primary/10"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[selected=true]:bg-background group-data-[selected=true]:text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.code ? <span className="font-mono">{item.code}</span> : null}
                            {item.code && item.label ? " · " : null}
                            {item.label}
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                        <CornerDownLeft className="hidden size-4 text-muted-foreground group-data-[selected=true]:block" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              {exactHits.length > 0 ? (
                <CommandGroup heading={t("groups.exact")}>
                  {exactHits.map((hit) => (
                    <HitRow
                      key={hitItemId(hit)}
                      hit={hit}
                      exact
                      onSelect={select}
                      t={t}
                      statusLabel={statusLabel}
                      query={parsed.text}
                    />
                  ))}
                </CommandGroup>
              ) : null}
              {groups.map((group) => (
                <CommandGroup key={group.id} heading={groupHeading(group.id)}>
                  {group.items.map((item) => {
                    const target = allTargets.get(item.id);
                    const Icon =
                      target?.type === "entry" ? getIconComponent(target.entry.iconKey) : Building2;
                    const shortcut = target?.type === "entry" ? target.entry.shortcut : undefined;
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={select}
                        disabled={isPending}
                        className="group gap-3 rounded-lg px-2 py-2.5 data-[selected=true]:bg-primary/10"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[selected=true]:bg-background group-data-[selected=true]:text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            <Highlighted text={item.label} query={parsed.text} />
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
                        <CornerDownLeft className="hidden size-4 text-muted-foreground group-data-[selected=true]:block" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
              {dataGroups.map((group) => (
                <CommandGroup key={group.type} heading={t(`dataGroups.${group.type}`)}>
                  {group.hits.map((hit) => (
                    <HitRow
                      key={hitItemId(hit)}
                      hit={hit}
                      exact={false}
                      onSelect={select}
                      t={t}
                      statusLabel={statusLabel}
                      query={parsed.text}
                    />
                  ))}
                  {group.showAll ? (
                    <CommandItem
                      value={group.showAll.id}
                      onSelect={select}
                      className="gap-2 rounded-lg px-2 py-2 text-sm text-primary data-[selected=true]:bg-primary/10"
                    >
                      <ArrowRight className="size-4" />
                      {t("showAll", { group: t(`dataGroups.${group.type}`) })}
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              ))}
            </CommandList>
            {previewHit ? (
              <GlobalSearchPreview
                ref={actionsRef}
                hit={previewHit}
                details={hitDetails(previewHit, t, false)}
                statusLabel={statusLabel}
                onOpen={() => select(hitItemId(previewHit))}
                onOpenNewTab={() => openInNewTab(hitItemId(previewHit))}
                onCopy={() => copyCode(previewHit)}
                onNavigate={(link) => {
                  close();
                  router.push(routeHref(link.href, link.query));
                }}
                onBack={() => inputRef.current?.focus()}
              />
            ) : null}
          </div>

          {showData && otherBranches.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
              <span>{t("otherBranches")}</span>
              {otherBranches.map((row) => (
                <button
                  key={row.branchId}
                  type="button"
                  disabled={isPending}
                  onClick={() => switchBranch(row.branchId, row.name)}
                  className="rounded-full border bg-background px-2 py-0.5 text-foreground hover:bg-accent"
                  title={t("switchBranch", { name: row.name })}
                >
                  {t("otherBranchCount", { name: row.name, count: row.count })}
                </button>
              ))}
            </div>
          ) : null}

          <div className="hidden items-center gap-4 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>↑↓</Kbd> {t("hints.navigate")}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> {t("hints.open")}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Ctrl ↵</Kbd> {t("hints.newTab")}
            </span>
            {previewHit ? (
              <span className="hidden items-center gap-1.5 lg:flex">
                <Kbd>→</Kbd> {t("hints.preview")}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd> {t("hints.close")}
            </span>
            <span className="ml-auto">
              {parsed.prefix ? t("hints.backToSearch") : t("hints.actionsMode")}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
