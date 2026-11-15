"use client";

import { Bookmark, Check, ChevronDown, Trash2, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "react-toastify";
import {
  deleteListViewAction,
  listSavedViewsAction,
  saveListViewAction,
  type ListSavedViews,
} from "@/app/actions/saved-views";
import { usePathname } from "@/i18n/navigation";
import { cn } from "./lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { viewQueryOf } from "./saved-views";

// The "Widoki" menu of every data table list (in its filter bar): the
// person's own views and the shared ones, one click applying a view, and the
// list's current address saved under a name. A view is the address without
// the page and the open record, so it keeps the search, the filters, the sort
// and the rows per page of any list, with nothing per list to wire.

// A list's views, kept while the page lives (a list opened again shows them
// at once and refreshes them behind).
const cache = new Map<string, ListSavedViews>();

const OPTION =
  "flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[5px] px-2 text-left hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none";
const HEADING = "px-2 pt-1 pb-1 text-[0.7rem] text-[var(--text-muted)]";

export interface SavedViewsMenuProps {
  /** The list's key (default: its route without the locale). */
  listKey?: string;
  /** More keys a view leaves out (the list's panel keys). */
  ignore?: readonly string[];
  /** The list changes its address in place (see FilterBar's `shallow`). */
  shallow?: boolean;
}

export function SavedViewsMenu({ listKey: givenKey, ignore = [], shallow }: SavedViewsMenuProps) {
  const pathname = usePathname();
  const listKey = givenKey ?? pathname;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ListSavedViews | null>(() => cache.get(listKey) ?? null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    setData(cache.get(listKey) ?? null);
    void listSavedViewsAction({ listKey })
      .then((result) => {
        if (!live) return;
        if (!result.success) return setFailed(true);
        cache.set(listKey, result.data);
        setData(result.data);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [listKey]);

  const update = (next: ListSavedViews) => {
    cache.set(listKey, next);
    setData(next);
  };

  const current = viewQueryOf(searchParams?.toString() ?? "", ignore);
  const views = data?.views ?? [];
  const queryOf = (query: string) => viewQueryOf(query, ignore);
  const own = views.filter((view) => !view.is_shared);
  const common = views.filter((view) => view.is_shared);
  const active = views.find((view) => queryOf(view.query) === current) ?? null;

  const apply = (query: string) => {
    setOpen(false);
    const href = `${window.location.pathname}${query}`;
    if (shallow) {
      // Next keeps useSearchParams in step; the list refetches its rows.
      window.history.pushState(null, "", href);
      return;
    }
    startTransition(() => router.push(href, { scroll: false }));
  };

  const save = () =>
    startTransition(async () => {
      const trimmed = name.trim();
      if (!trimmed || !data) return;
      const result = await saveListViewAction({
        listKey,
        name: trimmed,
        query: current,
        isShared: shared,
      });
      if (result.success === false) {
        toast.error(
          result.error === "duplicate_name"
            ? "Widok o tej nazwie już istnieje."
            : "Nie udało się zapisać widoku. Spróbuj ponownie."
        );
        return;
      }
      update({
        ...data,
        views: [...data.views, result.data].sort((a, b) => a.name.localeCompare(b.name, "pl")),
      });
      setName("");
      setShared(false);
      toast.success("Zapisano widok");
    });

  const remove = (id: string) =>
    startTransition(async () => {
      if (!data) return;
      const result = await deleteListViewAction({ id });
      if (!result.success) {
        toast.error("Nie udało się usunąć widoku. Spróbuj ponownie.");
        return;
      }
      update({ ...data, views: data.views.filter((view) => view.id !== id) });
    });

  const item = (view: ListSavedViews["views"][number]) => {
    const query = queryOf(view.query);
    const on = query === current;
    const removable = data && (view.user_id === data.userId || data.canManageShared);
    return (
      <li className="group flex items-center" key={view.id}>
        <button
          className={cn(OPTION, on && "font-semibold text-[var(--primary)]")}
          onClick={() => apply(query)}
          type="button"
        >
          <Check aria-hidden="true" className={cn("size-3.5 shrink-0", !on && "invisible")} />
          <span className="truncate">{view.name}</span>
        </button>
        {removable ? (
          <button
            aria-label={`Usuń widok ${view.name}`}
            className="mr-0.5 grid size-6 shrink-0 place-items-center rounded-[4px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--surface)] hover:text-[var(--danger)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
            disabled={pending}
            onClick={() => remove(view.id)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </li>
    );
  };

  // Not signed in to an organization (or the views did not load): no menu.
  if (failed && !data) return null;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger
              aria-label={active ? `Widoki, wybrany: ${active.name}` : "Widoki"}
              className={cn(
                "inline-flex h-7 max-w-48 items-center gap-1 rounded-[5px] px-1.5 text-[0.78rem] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none data-[state=open]:bg-[var(--surface-subtle)] data-[state=open]:text-[var(--text)]",
                active && "font-semibold text-[var(--primary)]"
              )}
            >
              <Bookmark aria-hidden="true" className="size-4 shrink-0" />
              {active ? <span className="truncate">{active.name}</span> : null}
              <ChevronDown aria-hidden="true" className="size-3 shrink-0 opacity-60" />
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Widoki</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="start" className="w-72 p-1 text-[0.8125rem]">
        {!data ? (
          <p className="px-2 py-2 text-xs text-[var(--text-muted)]">Wczytywanie widoków…</p>
        ) : !views.length ? (
          <p className="px-2 py-2 text-xs text-[var(--text-muted)]">
            Nie masz jeszcze zapisanych widoków. Ustaw filtry i sortowanie, a potem zapisz je
            poniżej.
          </p>
        ) : null}
        {own.length ? (
          <>
            <p className={HEADING}>Moje widoki</p>
            <ul className="grid gap-px">{own.map(item)}</ul>
          </>
        ) : null}
        {common.length ? (
          <>
            <p
              className={cn(
                HEADING,
                "mt-1 flex items-center gap-1 border-t border-[var(--border)] pt-2"
              )}
            >
              <Users aria-hidden="true" className="size-3" />
              Wspólne widoki
            </p>
            <ul className="grid gap-px">{common.map(item)}</ul>
          </>
        ) : null}
        {data ? (
          <form
            className="mt-1 grid gap-2 border-t border-[var(--border)] p-2"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <label className="grid gap-1 text-[0.7rem] text-[var(--text-muted)]">
              Zapisz obecne filtry i sortowanie jako widok
              <input
                className="h-8 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[0.8125rem] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                maxLength={160}
                onChange={(event) => setName(event.target.value)}
                placeholder="np. Aktywne, od najnowszych"
                value={name}
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input
                checked={shared}
                className="accent-[var(--primary)]"
                onChange={(event) => setShared(event.target.checked)}
                type="checkbox"
              />
              Udostępnij całej organizacji
            </label>
            <button
              className="h-8 rounded-[5px] bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              disabled={pending || !name.trim()}
              type="submit"
            >
              Zapisz widok
            </button>
          </form>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
