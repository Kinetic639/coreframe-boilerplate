"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Inbox, Loader2, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listKey, parseListParams, toQuery } from "@/server/requests/list-params";
import { REQUEST_FILTERS, type RequestListItem, type TicketTypeRef } from "@/server/requests/types";
import { LIST_CHANGED_EVENT } from "./live-events";
import { RequestCard } from "./request-card";
import { threadApi } from "./thread-api";

const PAGE_SIZE = 25;

/** URL query of the list; shallow, so changing a filter never re-renders the server tree. */
const listParsers = {
  scope: parseAsStringLiteral(["mine", "branch"] as const).withDefault("mine"),
  f: parseAsStringLiteral(REQUEST_FILTERS).withDefault("open"),
  type: parseAsString,
  q: parseAsString,
  sort: parseAsStringLiteral(["activity", "newest"] as const).withDefault("activity"),
  p: parseAsInteger.withDefault(1),
};

export type ListData = { items: RequestListItem[]; total: number };

/**
 * Persistent list + detail split. Lives in the (requests) layout, so opening another ticket
 * only re-renders the detail segment; filters live in the URL (nuqs, shallow) and refetch
 * just the list through a server action. The first render uses server data from the layout.
 */
export function RequestsShell({
  initial,
  initialKey,
  types,
  children,
}: {
  initial: ListData;
  initialKey: string;
  types: TicketTypeRef[];
  children: React.ReactNode;
}) {
  const t = useTranslations("requests");
  const { ticketId } = useParams<{ ticketId?: string }>();
  const [qs, setQs] = useQueryStates(listParsers, { shallow: true, history: "replace" });

  const input = useMemo(
    () =>
      parseListParams({
        scope: qs.scope,
        f: qs.f,
        type: qs.type ?? undefined,
        q: qs.q ?? undefined,
        sort: qs.sort,
        p: String(qs.p),
      }),
    [qs]
  );
  const query = useMemo(() => toQuery(input), [input]);
  const key = listKey(query);

  const [data, setData] = useState<ListData>(initial);
  const [loadedKey, setLoadedKey] = useState(initialKey);
  const [pending, startTransition] = useTransition();
  const requestSeq = useRef(0);

  // Server re-render (router.refresh / revalidatePath): adopt fresh data for the same query.
  useEffect(() => {
    if (initialKey === key) {
      setData(initial);
      setLoadedKey(initialKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, initialKey]);

  // Filters changed in the URL: fetch only the list.
  useEffect(() => {
    if (key === loadedKey) return;
    const seq = ++requestSeq.current;
    startTransition(async () => {
      const next = await threadApi.list(query);
      if (seq !== requestSeq.current || !next) return;
      setData(next);
      setLoadedKey(key);
    });
  }, [key, loadedKey, query]);

  // Realtime: something in the list changed -- refetch the current page in the background.
  useEffect(() => {
    const onChange = async () => {
      const seq = ++requestSeq.current;
      const next = await threadApi.list(query);
      if (seq !== requestSeq.current || !next) return;
      setData(next);
    };
    window.addEventListener(LIST_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(LIST_CHANGED_EVENT, onChange);
  }, [query]);

  const [searchText, setSearchText] = useState(qs.q ?? "");
  useEffect(() => {
    const id = setTimeout(() => {
      const value = searchText.trim().slice(0, 80) || null;
      if (value !== (qs.q ?? null)) void setQs({ q: value, p: 1 });
    }, 300);
    return () => clearTimeout(id);
  }, [searchText, qs.q, setQs]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    // Desktop: the list stays put and only the ticket detail scrolls (each pane scrolls itself).
    <div className="flex flex-1 lg:grid lg:min-h-0 lg:grid-cols-[minmax(380px,480px)_1fr] lg:overflow-hidden">
      <section
        className={cn(
          "min-w-0 flex-1 flex-col lg:flex lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-stone-200",
          ticketId ? "hidden" : "flex"
        )}
      >
        <div className="flex flex-col gap-2.5 border-b lg:sticky lg:top-0 lg:z-10 border-stone-200 bg-white px-4 pb-3 pt-1">
          <label
            className="flex h-10 items-center gap-2 rounded-[10px] bg-stone-100 px-3 text-stone-500"
            role="search"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Search className="h-4 w-4 shrink-0" />
            )}
            <span className="sr-only">{t("search")}</span>
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-500"
            />
          </label>
          <div className="flex items-center gap-2">
            <div
              role="tablist"
              className="grid flex-1 grid-cols-2 gap-0.5 rounded-[10px] bg-stone-100 p-[3px]"
            >
              {(["mine", "branch"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  role="tab"
                  aria-selected={qs.scope === scope}
                  onClick={() => void setQs({ scope, p: 1 })}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-[13px]",
                    qs.scope === scope
                      ? "bg-white font-semibold text-stone-900 shadow-[0_1px_2px_rgba(28,25,23,.08),0_0_0_1px_rgba(28,25,23,.04)]"
                      : "font-medium text-stone-600"
                  )}
                >
                  {t(`scope.${scope}`)}
                </button>
              ))}
            </div>
            {types.length > 0 && (
              <select
                value={qs.type ?? ""}
                onChange={(e) => void setQs({ type: e.target.value || null, p: 1 })}
                aria-label={t("type")}
                className="h-[38px] max-w-[42%] rounded-[10px] border border-stone-200 bg-white px-2 text-[13px] text-stone-700"
              >
                <option value="">{t("allTypes")}</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="-mr-4 flex gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none]">
            {REQUEST_FILTERS.map((f) => {
              const active = qs.f === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={active}
                  onClick={() => void setQs({ f, p: 1 })}
                  className={cn(
                    "flex h-[30px] shrink-0 items-center rounded-full border px-[11px] text-[12.5px] font-medium",
                    active
                      ? "border-stone-900 bg-stone-900 text-white"
                      : f === "yourTurn"
                        ? "border-[#F3C9B5] bg-[#FDF1EB] font-semibold text-[#A63A12]"
                        : "border-stone-200 bg-white text-stone-700"
                  )}
                >
                  {t(`filter.${f}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn("transition-opacity", pending && "opacity-60")}>
          {data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-stone-500">
              <Inbox className="h-8 w-8 text-stone-400" />
              <p className="text-sm font-medium text-stone-700">{t("empty.title")}</p>
              <p className="max-w-xs text-[13px]">{qs.q ? t("empty.search") : t("empty.body")}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 px-3 py-2.5">
              {data.items.map((item) => (
                <li key={item.id}>
                  <RequestCard item={item} selected={item.id === ticketId} query={query} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {pages > 1 && (
          <nav className="flex items-center justify-between px-4 pb-24 pt-1 text-xs text-stone-500 lg:pb-4">
            <span>{t("pageOf", { page: input.page, pages, total: data.total })}</span>
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={t("prev")}
                disabled={input.page <= 1}
                onClick={() => void setQs({ p: input.page - 1 })}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t("next")}
                disabled={input.page >= pages}
                onClick={() => void setQs({ p: input.page + 1 })}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </span>
          </nav>
        )}
      </section>

      <div
        className={cn(
          "min-w-0 flex-1 bg-stone-50 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overscroll-contain",
          ticketId ? "flex flex-col" : "hidden"
        )}
      >
        {children}
      </div>

      {!ticketId && (
        <Link
          href="/new"
          className="fixed bottom-6 right-4 z-30 flex h-[52px] items-center gap-2 rounded-2xl bg-primary pl-4 pr-5 text-[15px] font-semibold text-stone-900 shadow-[0_8px_24px_-6px_rgba(161,92,7,.45),0_2px_6px_rgba(28,25,23,.12)] lg:hidden"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
          {t("newLabel")}
        </Link>
      )}
    </div>
  );
}
