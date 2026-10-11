"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Hash, Loader2 } from "lucide-react";
import type {
  MentionItem,
  MentionOptions,
  MentionSuggestionListHandle,
  MentionSuggestionListProps,
} from "@repo/rich-text/mention";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useMentionPeople } from "@/hooks/queries/mentions";
import {
  ENTITY_SEARCH_DEBOUNCE_MS,
  MIN_ENTITY_QUERY,
  entitySearchQuery,
} from "@/lib/global-search/entity-search";
import { parsePaletteQuery } from "@/lib/global-search/palette";
import type { SearchSourceId } from "@/lib/global-search/sources";
import { useSearchSources } from "@/lib/global-search/sources-context";
import {
  MENTION_SOURCES,
  MENTION_SOURCE_TYPES,
  filterMentionPeople,
  hitMention,
  mentionKey,
  personMention,
  personName,
  readRecentMentions,
  rememberMention,
  type MentionPerson,
} from "@/lib/mentions";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { HIT_ICONS, Highlighted, hitDetails } from "@/components/v2/global-search/hit-display";
import type { ExactHitType, SearchExactHit } from "@/server/services/global-search.service";
import { useMentionScope } from "./mention-scope";

type TabScope = "all" | "people" | SearchSourceId;

type Row =
  | { key: string; kind: "person"; person: MentionPerson }
  | { key: string; kind: "hit"; hit: SearchExactHit }
  | { key: string; kind: "recent"; item: MentionItem };

const PEOPLE_LIMIT = 8;
const PEOPLE_LIMIT_MIXED = 4;
const HITS_LIMIT = 8;
const NO_PEOPLE: MentionPerson[] = [];
const NO_PRIORITY: ReadonlySet<string> = new Set();

function initials(person: MentionPerson) {
  const first = person.firstName?.trim()?.[0] ?? "";
  const last = person.lastName?.trim()?.[0] ?? "";
  return (first + last || (person.email ?? "?").slice(0, 2)).toUpperCase();
}

/**
 * The list shown after "@" in an editor: people of the organization (from the
 * first letter, those closest to the text first) and objects found by the
 * Ctrl+K search engine (from three characters) — same sources, permissions,
 * scope prefixes ("@zl:174232") and result rows as the palette.
 * Tab / Shift+Tab change the scope, ↑↓ move, Enter inserts, Esc closes.
 */
export const MentionSuggestionList = forwardRef<
  MentionSuggestionListHandle,
  MentionSuggestionListProps
>(function MentionSuggestionList({ query, onSelect, onClose }, ref) {
  const t = useTranslations("mentions");
  const ts = useTranslations("globalSearch");
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const activeBranchId = useAppStoreV2((s) => s.activeBranchId);
  const allowed = useSearchSources();
  const scopeOptions = useMentionScope();
  const priorityIds = scopeOptions.priorityUserIds ?? NO_PRIORITY;
  const narrowed = scopeOptions.sources;

  const sources = useMemo(
    () =>
      MENTION_SOURCES.filter(
        (source) => allowed.includes(source) && (!narrowed || narrowed.includes(source))
      ),
    [allowed, narrowed]
  );
  const tabs = useMemo<TabScope[]>(() => ["all", "people", ...sources], [sources]);
  const [tab, setTab] = useState<TabScope>("all");

  // A typed prefix ("zl:", "cz:", …) wins over the selected tab
  const parsed = useMemo(() => parsePaletteQuery(query, sources), [query, sources]);
  const scope: TabScope = parsed.scope ?? tab;
  const text = parsed.actionsMode ? query.trim() : parsed.text;

  const peopleQuery = useMentionPeople(orgId);
  const people = peopleQuery.data ?? NO_PEOPLE;
  const debouncedText = useDebounce(text, ENTITY_SEARCH_DEBOUNCE_MS);
  const searchScope = scope === "all" || scope === "people" ? undefined : scope;
  const searchEnabled =
    scope !== "people" && sources.length > 0 && debouncedText.length >= MIN_ENTITY_QUERY;
  const search = useQuery({
    ...entitySearchQuery(activeBranchId, searchScope, debouncedText),
    enabled: searchEnabled,
    placeholderData: (previous) => previous,
  });
  const showHits = searchEnabled && text.length >= MIN_ENTITY_QUERY;
  const loading =
    (scope !== "people" &&
      sources.length > 0 &&
      text.length >= MIN_ENTITY_QUERY &&
      (search.isFetching || debouncedText !== text)) ||
    (scope !== "all" && scope !== "people" ? false : peopleQuery.isLoading);

  const recent = useMemo(() => (orgId ? readRecentMentions(orgId) : []), [orgId]);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (scope === "all" || scope === "people") {
      const limit = scope === "people" || !showHits ? PEOPLE_LIMIT : PEOPLE_LIMIT_MIXED;
      for (const person of filterMentionPeople(people, text, priorityIds, limit)) {
        list.push({ key: `person:${person.userId}`, kind: "person", person });
      }
    }
    if (scope === "all" && !text) {
      const types = new Set(sources.map((source) => MENTION_SOURCE_TYPES[source] as string));
      for (const item of recent) {
        if (types.has(item.type))
          list.push({ key: `recent:${mentionKey(item)}`, kind: "recent", item });
      }
    }
    if (showHits && search.data) {
      const types = new Set<string>(
        (searchScope ? [searchScope] : sources).map(
          (source) => MENTION_SOURCE_TYPES[source] as string
        )
      );
      const seen = new Set<string>();
      for (const hit of [...search.data.exact, ...search.data.results]) {
        const key = `hit:${hit.type}:${hit.id}`;
        if (!types.has(hit.type) || seen.has(key)) continue;
        seen.add(key);
        list.push({ key, kind: "hit", hit });
        if (seen.size >= HITS_LIMIT) break;
      }
    }
    return list;
  }, [people, priorityIds, recent, scope, search.data, searchScope, showHits, sources, text]);

  // The highlighted row resets whenever the query or the scope changes
  const signature = `${tab}|${query}`;
  const [activeState, setActiveState] = useState({ signature, index: 0 });
  const active =
    activeState.signature === signature ? Math.min(activeState.index, rows.length - 1) : 0;
  const setActive = (index: number) => setActiveState({ signature, index });

  const select = (row: Row | undefined) => {
    if (!row) return;
    const item =
      row.kind === "person"
        ? personMention(row.person)
        : row.kind === "hit"
          ? hitMention(row.hit)
          : row.item;
    if (orgId) rememberMention(orgId, item);
    onSelect(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (rows.length > 0) {
          const step = event.key === "ArrowDown" ? 1 : -1;
          setActive((active + step + rows.length) % rows.length);
        }
        return true;
      }
      if (event.key === "Tab") {
        const step = event.shiftKey ? -1 : 1;
        const index = Math.max(tabs.indexOf(tab), 0);
        setTab(tabs[(index + step + tabs.length) % tabs.length]);
        return true;
      }
      if (event.key === "Enter") {
        if (rows.length === 0) {
          // Nothing to insert: the "@" stays as text and Enter does its usual job
          onClose();
          return false;
        }
        select(rows[active]);
        return true;
      }
      return false;
    },
  }));

  // "@ home" or a sentence going on after the name: this is prose, not a mention
  const prose = /\s/.test(text) && rows.length === 0 && !loading;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (prose) onCloseRef.current();
  }, [prose]);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active, rows]);

  const firstOf = (kind: Row["kind"]) => rows.findIndex((row) => row.kind === kind);
  const heading = (index: number, row: Row) =>
    index === firstOf(row.kind)
      ? row.kind === "person"
        ? t("groupPeople")
        : row.kind === "recent"
          ? t("groupRecent")
          : scope === "all"
            ? t("groupResults")
            : null
      : null;

  return (
    <div
      className="flex w-[320px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
      data-testid="mention-list"
      // Clicking the list must not take the focus (and the selection) from the editor
      onMouseDown={(event) => event.preventDefault()}
    >
      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="flex gap-0.5 overflow-x-auto border-b px-1 py-1 [scrollbar-width:none]"
      >
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={scope === item}
            onClick={() => setTab(item)}
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[11px] leading-4",
              scope === item
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item === "all" ? t("all") : item === "people" ? t("people") : ts(`scopes.${item}`)}
          </button>
        ))}
      </div>

      <div ref={listRef} role="listbox" className="max-h-[236px] overflow-y-auto py-0.5">
        {rows.map((row, index) => {
          const label = heading(index, row);
          const isActive = index === active;
          return (
            <div key={row.key}>
              {label ? (
                <div className="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
              ) : null}
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                data-active={isActive ? "true" : "false"}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(row)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 px-2 py-1 text-left text-xs",
                  isActive && "bg-muted"
                )}
              >
                {row.kind === "person" ? (
                  <>
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted-foreground/15 text-[9px] font-semibold text-foreground/80">
                      {initials(row.person)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">
                        <Highlighted text={personName(row.person)} query={text} />
                      </span>
                      {row.person.jobTitle || row.person.email ? (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          {row.person.jobTitle ?? row.person.email}
                        </span>
                      ) : null}
                    </span>
                    {priorityIds.has(row.person.userId) ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {t("inConversation")}
                      </span>
                    ) : null}
                  </>
                ) : row.kind === "hit" ? (
                  <HitRow
                    hit={row.hit}
                    query={text}
                    details={hitDetails(row.hit, ts, scope === "all")}
                  />
                ) : (
                  <RecentRow item={row.item} />
                )}
              </button>
            </div>
          );
        })}

        {rows.length === 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground">
            {loading ? (
              <>
                <Loader2 className="size-3 animate-spin" /> {t("searching")}
              </>
            ) : scope !== "people" && sources.length > 0 && text.length < MIN_ENTITY_QUERY ? (
              t("typeMore")
            ) : (
              t("empty")
            )}
          </div>
        ) : null}
      </div>

      <div className="border-t px-2 py-1 text-[10px] text-muted-foreground">{t("hint")}</div>
    </div>
  );
});

function HitRow({ hit, query, details }: { hit: SearchExactHit; query: string; details: string }) {
  const Icon = HIT_ICONS[hit.type] ?? Hash;
  return (
    <>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {hit.code ? (
            <span className="shrink-0 font-mono text-[11px]">
              <Highlighted text={hit.code} query={query} />
            </span>
          ) : null}
          {hit.title ? (
            <span className="truncate">
              <Highlighted text={hit.title} query={query} />
            </span>
          ) : null}
        </span>
        {details ? (
          <span className="truncate text-[10px] text-muted-foreground">{details}</span>
        ) : null}
      </span>
    </>
  );
}

function RecentRow({ item }: { item: MentionItem }) {
  const Icon = HIT_ICONS[item.type as ExactHitType] ?? Hash;
  return (
    <>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        {item.code ? <span className="shrink-0 font-mono text-[11px]">{item.code}</span> : null}
        {item.label && item.label !== item.code ? (
          <span className="truncate">{item.label}</span>
        ) : null}
      </span>
    </>
  );
}

/** Mentions of people and objects, ready to pass to any editor of `@repo/rich-text` */
export const ENTITY_MENTIONS: MentionOptions = { SuggestionList: MentionSuggestionList };
