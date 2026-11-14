"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/kolor-sensu/data-table/filter-bar";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import { ListPane, ListSidePanel } from "@/components/kolor-sensu/data-table/list-pane";
import { useListKeys } from "@/components/kolor-sensu/data-table/use-list-keys";
import {
  useCreatePositionMutation,
  useDeletePositionMutation,
  usePositionsQuery,
  useUpdatePositionMutation,
} from "@/hooks/queries/organization";
import type { OrgPosition } from "@/server/services/organization.service";
import {
  positionHref,
  positionPage,
  positionParsers,
  POSITION_PAGE_SIZES,
  type PositionState,
} from "./positions-state";

type DialogMode = "create" | "edit" | null;

/** The positions: all of them, filtered, sorted and paged by the address. */
export function PositionsWorkspace({
  initialPositions,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  canManage,
}: {
  initialPositions: OrgPosition[];
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canManage: boolean;
}) {
  const [state] = useQueryStates(positionParsers);
  const positions = usePositionsQuery(initialPositions);
  const all = useMemo(() => positions.data ?? [], [positions.data]);
  const page = useMemo(() => positionPage(all, state), [all, state]);
  const [layout, setLayout] = useState(savedLayout);

  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback(
    (patch: Partial<PositionState>) => positionHref(path, state, patch),
    [path, state]
  );
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

  const createMutation = useCreatePositionMutation();
  const updateMutation = useUpdatePositionMutation();
  const deleteMutation = useDeletePositionMutation();
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editing, setEditing] = useState<OrgPosition | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setDialogMode("create");
  };
  const openEdit = (position: OrgPosition) => {
    setEditing(position);
    setName(position.name);
    setDescription(position.description ?? "");
    setDialogMode("edit");
  };
  const submit = () => {
    if (!name.trim()) return;
    if (dialogMode === "create") {
      createMutation.mutate(
        { name: name.trim(), description: description || null },
        {
          onSuccess: (position) => {
            setDialogMode(null);
            preview(position.id);
          },
        }
      );
    } else if (dialogMode === "edit" && editing) {
      updateMutation.mutate(
        { positionId: editing.id, name: name.trim(), description: description || null },
        { onSuccess: () => setDialogMode(null) }
      );
    }
  };
  const remove = (position: OrgPosition) => {
    if (!window.confirm(labels.confirmDelete.replace("{name}", position.name))) return;
    deleteMutation.mutate(
      { positionId: position.id },
      { onSuccess: () => state.selected === position.id && preview(null) }
    );
  };

  const sortOf = (field: PositionState["sort"]) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const rowHref = (row: OrgPosition) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const date = (value: string | null) =>
    value ? (
      <span className="text-xs text-muted-foreground">
        {new Date(value).toLocaleDateString(labels.locale)}
      </span>
    ) : (
      "—"
    );
  const selected = all.find((position) => position.id === state.selected) ?? null;

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{labels.title}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{page.totalCount}</span>
          </div>
          {canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" />
              {labels.create}
            </Button>
          ) : null}
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={positionParsers}
            fields={[]}
            resetOnChange={["strona", "selected"]}
            shallow
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <ListPane
            rows={page.rows}
            totalCount={page.totalCount}
            page={page.page}
            size={state.wierszy}
            sizes={POSITION_PAGE_SIZES}
            selected={state.selected}
            rowKey={(row) => row.id}
            rowHref={rowHref}
            pageHref={(strona) => href({ strona, selected: null })}
            sizeHref={(wierszy) =>
              href({ wierszy: wierszy as PositionState["wierszy"], strona: 1, selected: null })
            }
            set={set}
            layout={layout}
            widths={widths}
            cookie={cookie}
            onLayoutChange={setLayout}
            sortOf={(id) => (id === "created_at" ? sortOf("created_at") : undefined)}
            pinnedSort={sortOf("name")}
            identity={(row) => (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  <Briefcase className="size-3.5 text-muted-foreground" />
                </span>
                <span className="block min-w-0 truncate text-[13px] font-medium" title={row.name}>
                  {row.name}
                </span>
              </>
            )}
            value={(row, id) =>
              id === "description" ? (
                <span className="text-muted-foreground">{row.description || "—"}</span>
              ) : (
                date(row.created_at)
              )
            }
            labels={labels}
            empty={state.q ? labels.empty : labels.emptyAll}
            onPreview={preview}
          />
          {state.selected ? (
            <ListSidePanel
              titleId="org-position-panel-title"
              title={selected?.name ?? labels.notFound}
              backLabel={labels.title}
              closeLabel={labels.close}
              onClose={() => preview(null)}
              actions={
                selected && canManage ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(selected)}
                      disabled={isPending}
                    >
                      <Pencil className="mr-1.5 size-3.5" />
                      {labels.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(selected)}
                      disabled={isPending}
                    >
                      <Trash2 className="mr-1.5 size-3.5" />
                      {labels.delete}
                    </Button>
                  </>
                ) : null
              }
            >
              {selected ? (
                <dl className="grid gap-4 p-5 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{labels.column_description}</dt>
                    <dd className="whitespace-pre-wrap">
                      {selected.description || (
                        <span className="text-muted-foreground">{labels.noDescription}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{labels.column_created_at}</dt>
                    <dd>{new Date(selected.created_at).toLocaleString(labels.locale)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">{labels.notFound}</p>
              )}
            </ListSidePanel>
          ) : null}
        </div>
      </section>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? labels.dialogTitleCreate : labels.dialogTitleEdit}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="position-name">{labels.dialogName}</Label>
              <Input
                id="position-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={labels.dialogNamePlaceholder}
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-description">{labels.column_description}</Label>
              <Textarea
                id="position-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={labels.dialogDescriptionPlaceholder}
                maxLength={300}
                rows={2}
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
              {labels.cancel}
            </Button>
            <Button onClick={submit} disabled={isPending || !name.trim()}>
              {isPending
                ? labels.saving
                : dialogMode === "create"
                  ? labels.dialogCreate
                  : labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableNavigationProvider>
  );
}
