"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Building2,
  Car,
  CheckSquare,
  CornerDownLeft,
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
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { signOutAction } from "@/app/[locale]/actions";
import {
  ACTIONS_PREFIX,
  buildPaletteGroups,
  parsePaletteQuery,
  type PaletteItem,
} from "@/lib/global-search/palette";
import type { SearchEntry } from "@/lib/global-search/types";
import { useDebounce } from "@/hooks/use-debounce";
import { globalSearchAction, type GlobalSearchResult } from "@/app/actions/global-search";
import type { ExactHitType, SearchExactHit } from "@/server/services/global-search.service";
import { useGlobalSearchStore } from "./global-search-store";

// Same landing route as the sidebar branch switcher: branch-neutral, never 404s.
const SAFE_ROUTE_AFTER_BRANCH_SWITCH = "/dashboard/start";
const BRANCH_ITEM_PREFIX = "branch:";
const HIT_ITEM_PREFIX = "hit:";
const SEARCH_DEBOUNCE_MS = 200;
const MIN_DATA_QUERY = 3;
const EMPTY_RESULT: GlobalSearchResult = { exact: [], results: [] };

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
  | { type: "hit"; hit: SearchExactHit };

function hitItemId(hit: SearchExactHit): string {
  return `${HIT_ITEM_PREFIX}${hit.type}:${hit.id}`;
}

function hitHref(hit: SearchExactHit) {
  const pathname = toUnsafeI18nHref(hit.href);
  return hit.query ? { pathname, query: hit.query } : pathname;
}

interface GlobalSearchDialogProps {
  /** Server-resolved pages and actions the user may open */
  entries: SearchEntry[];
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
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
}

function HitRow({ hit, exact, onSelect, t, statusLabel }: HitRowProps) {
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
          {hit.code ? <span className="font-mono">{hit.code}</span> : null}
          {hit.code && hit.title ? " · " : null}
          {hit.title}
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
export function GlobalSearchDialog({ entries }: GlobalSearchDialogProps) {
  const t = useTranslations("globalSearch");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { resolvedTheme, setTheme } = useTheme();
  const setStoreTheme = useUiStoreV2((s) => s.setTheme);
  const { accessibleBranches, activeBranchId, setActiveBranch } = useAppStoreV2();
  const { open, initialQuery, setOpen, toggle } = useGlobalSearchStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [isPending, startTransition] = useTransition();

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

  const groups = useMemo(() => buildPaletteGroups(query, items), [query, items]);
  const { actionsMode } = parsePaletteQuery(query);

  // Data: exact hits for a recognized identifier (ZL, VIN, HD-, PZ/…, code) and
  // fragment matches across orders, parts, locations, … — one server call
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const dataText = parsePaletteQuery(debouncedQuery).actionsMode ? "" : debouncedQuery.trim();
  const dataEnabled = open && !actionsMode && dataText.length >= MIN_DATA_QUERY;
  const dataQuery = useQuery({
    queryKey: ["global-search", "data", activeBranchId, dataText],
    queryFn: async () => {
      const result = await globalSearchAction(dataText);
      return result.success ? result.data : EMPTY_RESULT;
    },
    enabled: dataEnabled,
    staleTime: 30_000,
    // Keep the previous results on screen while the next query loads
    placeholderData: (previous) => previous,
  });
  const showData = dataEnabled && query.trim().length >= MIN_DATA_QUERY;
  const data = showData ? (dataQuery.data ?? EMPTY_RESULT) : EMPTY_RESULT;
  const exactHits = data.exact;
  const dataLoading = dataEnabled && dataQuery.isFetching;

  const dataGroups = useMemo(
    () =>
      DATA_GROUP_ORDER.map((type) => ({
        type,
        hits: data.results.filter((hit) => hit.type === type),
      })).filter((group) => group.hits.length > 0),
    [data.results]
  );

  const allTargets = useMemo(() => {
    if (exactHits.length === 0 && data.results.length === 0) return targets;
    const map = new Map(targets);
    for (const hit of [...exactHits, ...data.results]) {
      map.set(hitItemId(hit), { type: "hit", hit });
    }
    return map;
  }, [data.results, exactHits, targets]);

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

  const select = useCallback(
    (id: string) => {
      const target = allTargets.get(id);
      if (!target) return;
      if (target.type === "branch") switchBranch(target.branchId, target.name);
      else if (target.type === "hit") {
        close();
        router.push(hitHref(target.hit));
      } else runEntry(target.entry);
    },
    [allTargets, close, router, runEntry, switchBranch]
  );

  const openInNewTab = useCallback(
    (id: string) => {
      const target = allTargets.get(id);
      let href;
      if (target?.type === "hit") href = hitHref(target.hit);
      else if (target?.type === "entry" && target.entry.href && !target.entry.command)
        href = toUnsafeI18nHref(target.entry.href);
      if (!href) return false;
      window.open(getPathname({ href, locale }), "_blank", "noopener");
      close();
      return true;
    },
    [allTargets, close, locale]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && selected) {
      if (openInNewTab(selected)) event.preventDefault();
    }
    if (event.key === "Backspace" && query === ACTIONS_PREFIX) {
      event.preventDefault();
      setQuery("");
    }
  };

  const groupHeading = (id: string) =>
    t.has(`groups.${id}`) ? t(`groups.${id}`) : t(`sections.${id}`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideClose
        className="top-0 flex h-dvh max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:top-[12vh] sm:h-auto sm:max-h-[76vh] sm:max-w-2xl sm:rounded-xl"
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
            {actionsMode ? (
              <span className="ml-3 shrink-0 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                {t("actionsModeBadge")}
              </span>
            ) : null}
            <div className="flex-1">
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder={actionsMode ? t("actionsPlaceholder") : t("placeholder")}
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

          <CommandList className="!max-h-none min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:!max-h-[60vh]">
            <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
              {dataLoading ? t("searching") : t("empty")}
            </CommandEmpty>
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
                        <span className="block truncate text-sm font-medium">{item.label}</span>
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
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>

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
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd> {t("hints.close")}
            </span>
            <span className="ml-auto">
              {actionsMode ? t("hints.backToSearch") : t("hints.actionsMode")}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
