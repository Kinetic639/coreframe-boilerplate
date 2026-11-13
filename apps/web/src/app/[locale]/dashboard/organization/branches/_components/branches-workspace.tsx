"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { Building2, Map, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import { ListPane, ListSidePanel } from "@/components/kolor-sensu/data-table/list-pane";
import { useListKeys } from "@/components/kolor-sensu/data-table/use-list-keys";
import { CREATED_WITHIN } from "@/components/kolor-sensu/data-table/local-list";
import { RowActions, RowActionLink } from "@/components/kolor-sensu/row-actions";
import {
  useBranchesQuery,
  useCreateBranchMutation,
  useDeleteBranchMutation,
  useUpdateBranchMutation,
} from "@/hooks/queries/organization";
import type { OrgBranch } from "@/server/services/organization.service";
import { BranchWarehousesPanel } from "./branch-warehouses-panel";
import {
  branchHref,
  branchPage,
  branchParsers,
  BRANCH_MAPS,
  BRANCH_PAGE_SIZES,
  type BranchState,
} from "./branches-state";

/** Columns the list sorts by. */
const SORT_FIELD: Record<string, BranchState["sort"]> = {
  number: "branch_number",
  slug: "slug",
  created_at: "created_at",
};

type DialogMode = "create" | "edit" | null;

/**
 * The branches: every branch of the organization, filtered, sorted and paged
 * by the address, with the open branch (its units and warehouses) beside
 * the list.
 */
export function BranchesWorkspace({
  initialBranches,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  canCreate,
  canUpdate,
  canDelete,
  canManageStructure,
}: {
  initialBranches: OrgBranch[];
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageStructure: boolean;
}) {
  const router = useRouter();
  const [state] = useQueryStates(branchParsers);
  const branches = useBranchesQuery(initialBranches);
  const all = useMemo(() => branches.data ?? [], [branches.data]);
  const page = useMemo(() => branchPage(all, state), [all, state]);
  const [layout, setLayout] = useState(savedLayout);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback(
    (patch: Partial<BranchState>) => branchHref(path, state, patch),
    [path, state]
  );
  const preview = useCallback(
    (selected: string | null) => navigate(href({ selected })),
    [navigate, href]
  );
  const keys = useMemo(() => page.rows.map((row) => row.id), [page.rows]);
  useListKeys(keys, state.selected, preview);

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (state.strona !== page.page)
      window.history.replaceState(null, "", href({ strona: page.page }));
  }, [href, page.page, state.strona]);

  const createMutation = useCreateBranchMutation();
  const updateMutation = useUpdateBranchMutation();
  const deleteMutation = useDeleteBranchMutation();
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editing, setEditing] = useState<OrgBranch | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDialogMode("create");
  };
  const openEdit = (branch: OrgBranch) => {
    setEditing(branch);
    setName(branch.name);
    setSlug(branch.slug ?? "");
    setDialogMode("edit");
  };
  // The branch switcher and the sidebar read the branches too.
  const afterChange = () => router.refresh();
  const submit = () => {
    if (!name.trim()) return;
    if (dialogMode === "create") {
      createMutation.mutate(
        { name: name.trim(), slug: slug || null },
        {
          onSuccess: (branch) => {
            setDialogMode(null);
            afterChange();
            preview(branch.id);
          },
        }
      );
    } else if (dialogMode === "edit" && editing) {
      updateMutation.mutate(
        { branchId: editing.id, name: name.trim(), slug: slug || null },
        {
          onSuccess: () => {
            setDialogMode(null);
            afterChange();
          },
        }
      );
    }
  };
  const remove = (branch: OrgBranch) => {
    if (!window.confirm(labels.confirmDelete.replace("{name}", branch.name))) return;
    deleteMutation.mutate(
      { branchId: branch.id },
      {
        onSuccess: () => {
          if (state.selected === branch.id) preview(null);
          afterChange();
        },
      }
    );
  };

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "mapy",
      label: labels.column_public_maps,
      options: BRANCH_MAPS.map((value) => ({ value, label: labels[`maps_${value}`] })),
    },
    {
      kind: "dates",
      id: "created_at",
      label: labels.column_created_at,
      options: CREATED_WITHIN.map((value) => ({ value, label: labels[`within_${value}`] })),
      keys: { scope: "utworzono", from: "utworzono_od", to: "utworzono_do" },
    },
  ];
  const order = ["branch", ...layout.map((column) => column.id)].map((id) =>
    id === "public_maps" ? "mapy" : id
  );

  const sortOf = (field: BranchState["sort"]) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const rowHref = (row: OrgBranch) => href({ selected: state.selected === row.id ? null : row.id });
  const mapsBadge = (row: OrgBranch) =>
    row.public_warehouse_maps_enabled ? (
      <Badge variant="secondary" className="font-normal">
        <Map className="mr-1 size-3" />
        {labels.maps_tak}
      </Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  const value = (row: OrgBranch, id: string) => {
    switch (id) {
      case "number":
        return <span className="font-mono text-xs">{row.branch_number}</span>;
      case "slug":
        return row.slug ? <span className="font-mono text-xs">{row.slug}</span> : "—";
      case "public_maps":
        return mapsBadge(row);
      case "created_at":
        return row.created_at ? (
          <span className="text-xs text-muted-foreground">
            {new Date(row.created_at).toLocaleDateString(labels.locale)}
          </span>
        ) : (
          "—"
        );
      default:
        return "—";
    }
  };
  const selected = all.find((branch) => branch.id === state.selected) ?? null;
  const filtered = !!(
    state.q ||
    state.mapy.length ||
    state.utworzono ||
    state.utworzono_od ||
    state.utworzono_do
  );

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
            <span className="text-xs tabular-nums text-muted-foreground">{page.totalCount}</span>
          </div>
          {canCreate ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" />
              {labels.create}
            </Button>
          ) : null}
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={branchParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
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
            sizes={BRANCH_PAGE_SIZES}
            selected={state.selected}
            rowKey={(row) => row.id}
            rowHref={rowHref}
            pageHref={(strona) => href({ strona, selected: null })}
            sizeHref={(wierszy) =>
              href({ wierszy: wierszy as BranchState["wierszy"], strona: 1, selected: null })
            }
            set={set}
            layout={layout}
            widths={widths}
            cookie={cookie}
            onLayoutChange={setLayout}
            sortOf={(id) => (SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined)}
            pinnedSort={sortOf("name")}
            identity={(row) => (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  <Building2 className="size-3.5 text-muted-foreground" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium" title={row.name}>
                    {row.name}
                  </span>
                  <span className="block truncate font-mono text-[11px] leading-4 font-normal text-muted-foreground">
                    #{row.branch_number}
                  </span>
                </span>
              </>
            )}
            value={value}
            actions={(row) => (
              <RowActions label={row.name}>
                <RowActionLink href={rowHref(row)} icon={<Building2 className="size-4" />}>
                  {labels.preview}
                </RowActionLink>
              </RowActions>
            )}
            labels={labels}
            empty={filtered ? labels.empty : labels.emptyAll}
            onPreview={preview}
          />
          {state.selected ? (
            <ListSidePanel
              titleId="org-branch-panel-title"
              title={selected?.name ?? labels.notFound}
              backLabel={labels.title}
              closeLabel={labels.close}
              onClose={() => preview(null)}
              actions={
                selected && (canUpdate || canDelete) ? (
                  <>
                    {canUpdate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(selected)}
                        disabled={isPending}
                      >
                        <Pencil className="mr-1.5 size-3.5" />
                        {labels.edit}
                      </Button>
                    ) : null}
                    {canDelete ? (
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
                    ) : null}
                  </>
                ) : null
              }
            >
              {selected ? (
                <div className="space-y-5 p-5">
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">{labels.column_number}</dt>
                      <dd className="font-mono">{selected.branch_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{labels.column_slug}</dt>
                      <dd className="font-mono">{selected.slug || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{labels.column_public_maps}</dt>
                      <dd>{mapsBadge(selected)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{labels.column_created_at}</dt>
                      <dd>
                        {selected.created_at
                          ? new Date(selected.created_at).toLocaleString(labels.locale)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <BranchWarehousesPanel
                    key={selected.id}
                    branchId={selected.id}
                    canManage={canManageStructure}
                  />
                </div>
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
              <Label htmlFor="branch-name">{labels.dialogName}</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={labels.dialogNamePlaceholder}
                maxLength={200}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-slug">{labels.column_slug}</Label>
              <Input
                id="branch-slug"
                value={slug}
                onChange={(event) =>
                  setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder={labels.dialogSlugPlaceholder}
                maxLength={100}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{labels.dialogSlugHint}</p>
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
