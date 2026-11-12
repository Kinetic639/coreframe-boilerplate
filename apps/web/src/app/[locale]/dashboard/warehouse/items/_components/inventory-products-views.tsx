"use client";

import { useState, useTransition } from "react";
import { Bookmark, Check, ChevronDown, Trash2, Users } from "lucide-react";
import { toast } from "react-toastify";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import {
  deleteInventoryViewAction,
  listInventoryViewsAction,
  saveInventoryViewAction,
} from "@/app/actions/warehouse/inventory";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/kolor-sensu/popover";
import { cn } from "@/lib/utils";
import { inventoryProductKeys, type ProductsScope } from "./inventory-product-query";
import {
  productParsers,
  serializeProductState,
  type ProductState,
} from "./inventory-products-state";

export const PRODUCT_VIEWS_ENTITY = "inventory_products";

export interface SavedView {
  id: string;
  name: string;
  config: Record<string, unknown>;
  is_shared: boolean;
  user_id: string | null;
}

/**
 * What a view keeps: the list's address without the page, the open product
 * and its tab (search, filters, sort, rows per page, grouping).
 */
export function viewQuery(state: Partial<ProductState>) {
  return serializeProductState({ ...state, strona: null, selected: null, tab: null });
}

/**
 * The "Widoki" menu: saved views only (the filters are all in the bar) --
 * the person's own and the shared ones;
 * one click applies a view (the address changes, the list follows), and the
 * current search, filters and sort can be saved under a name.
 */
export function ProductViews({
  scope,
  path,
  userId,
  canShare,
  labels,
}: {
  scope: ProductsScope;
  path: string;
  userId: string;
  /** May save views for everyone (products.manage). */
  canShare: boolean;
  labels: Record<string, string>;
}) {
  const queryClient = useQueryClient();
  const [state] = useQueryStates(productParsers);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, startTransition] = useTransition();
  const viewsKey = inventoryProductKeys.views(scope);
  const views = useQuery({
    queryKey: viewsKey,
    queryFn: async () => {
      const result = await listInventoryViewsAction({ entity: PRODUCT_VIEWS_ENTITY });
      if (!result.success || !("data" in result)) throw new Error(labels.loadError);
      return result.data as SavedView[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const current = viewQuery(state);
  const own = (views.data ?? []).filter((view) => !view.is_shared);
  const common = (views.data ?? []).filter((view) => view.is_shared);
  const queryOf = (view: SavedView) =>
    typeof view.config.query === "string" ? view.config.query : "";
  const active = (views.data ?? []).find((view) => queryOf(view) === current)?.name ?? null;

  const apply = (query: string) => {
    window.history.pushState(null, "", `${path}${query}`);
    setOpen(false);
  };

  const save = () =>
    startTransition(async () => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const result = await saveInventoryViewAction({
        entity: PRODUCT_VIEWS_ENTITY,
        name: trimmed,
        config: { query: current, version: 1 },
        is_shared: canShare && shared,
      });
      if (!result.success || !("data" in result)) {
        toast.error("error" in result ? String(result.error) : labels.loadError);
        return;
      }
      const saved: SavedView = {
        id: result.data.id,
        name: trimmed,
        config: { query: current, version: 1 },
        is_shared: canShare && shared,
        user_id: userId,
      };
      queryClient.setQueryData<SavedView[]>(viewsKey, (list) =>
        [...(list ?? []), saved].sort((a, b) => a.name.localeCompare(b.name))
      );
      setName("");
      setShared(false);
      toast.success(labels.viewSaved);
    });

  const remove = (view: SavedView) =>
    startTransition(async () => {
      const result = await deleteInventoryViewAction({ id: view.id });
      if (!result.success) {
        toast.error("error" in result ? String(result.error) : labels.loadError);
        return;
      }
      queryClient.setQueryData<SavedView[]>(viewsKey, (list) =>
        (list ?? []).filter((one) => one.id !== view.id)
      );
    });

  const item = (key: string, label: string, query: string, view?: SavedView) => (
    <li key={key} className="group flex items-center">
      <button
        type="button"
        onClick={() => apply(query)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted",
          query === current && "font-medium text-primary"
        )}
      >
        <Check className={cn("size-3.5 shrink-0", query !== current && "invisible")} />
        <span className="truncate">{label}</span>
      </button>
      {view && (view.user_id === userId || (view.is_shared && canShare)) ? (
        <button
          type="button"
          aria-label={`${labels.viewDelete}: ${label}`}
          disabled={pending}
          onClick={() => remove(view)}
          className="invisible rounded p-1 text-muted-foreground group-hover:visible hover:bg-muted hover:text-destructive focus-visible:visible"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </li>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={labels.views}
        className="inline-flex h-7 max-w-48 items-center gap-1 rounded px-1.5 text-xs hover:bg-muted"
      >
        <Bookmark className="size-3.5 shrink-0" />
        <span className="truncate">{active ?? labels.views}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1 text-[0.8125rem]">
        {!own.length && !common.length ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">{labels.viewsEmpty}</p>
        ) : null}
        {own.length ? (
          <>
            <p className="px-2 pt-1 pb-1 text-[0.7rem] text-muted-foreground">{labels.viewsMine}</p>
            <ul>{own.map((view) => item(view.id, view.name, queryOf(view), view))}</ul>
          </>
        ) : null}
        {common.length ? (
          <>
            <p className="mt-1 flex items-center gap-1 border-t px-2 pt-2 pb-1 text-[0.7rem] text-muted-foreground">
              <Users className="size-3" />
              {labels.viewsShared}
            </p>
            <ul>{common.map((view) => item(view.id, view.name, queryOf(view), view))}</ul>
          </>
        ) : null}
        <form
          className="mt-1 grid gap-2 border-t p-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="grid gap-1 text-[0.7rem] text-muted-foreground">
            {labels.viewSaveCurrent}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={160}
              placeholder={labels.viewName}
              className="h-8 rounded border bg-background px-2 text-[0.8125rem] text-foreground"
            />
          </label>
          {canShare ? (
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={shared}
                onChange={(event) => setShared(event.target.checked)}
                className="accent-primary"
              />
              {labels.viewShare}
            </label>
          ) : null}
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="h-8 rounded bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {labels.viewSave}
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
