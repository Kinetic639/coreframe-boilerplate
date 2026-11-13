"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { toast } from "react-toastify";
import { ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import { deleteTicketTypeAction } from "@/app/actions/help-desk";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import type { MemberOption } from "@/components/help-desk/member-selector";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import { TICKET_PRIORITIES } from "@/lib/validations/helpdesk";
import { TicketTypeFormDialog } from "./ticket-type-form-dialog";
import { TicketTypeDetailPanel } from "./ticket-type-detail-panel";
import { TicketTypesTable } from "./ticket-types-table";
import {
  ticketTypeHref,
  ticketTypePage,
  ticketTypeParsers,
  TYPE_ACTIVITY,
  TYPE_SCOPES,
  YES_NO,
} from "./ticket-types-state";

type TicketType = HelpdeskTicketTypeWithDetails;

/**
 * The ticket types list: title bar, filters, table and side panel. The page
 * hands over every type; the address narrows, sorts and pages them here, so
 * a change of filter or page only pushes a new address. After a save or a
 * delete the server renders the list again.
 */
export function TicketTypesView({
  types,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  members,
  branches,
  priorityConfigs,
  typePathTemplate,
}: {
  types: TicketType[];
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  members: MemberOption[];
  branches: { id: string; name: string }[];
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
  typePathTemplate: string;
}) {
  const router = useRouter();
  const [state] = useQueryStates(ticketTypeParsers);
  const data = useMemo(() => ticketTypePage(types, state), [types, state]);
  const [layout, setLayout] = useState(savedLayout);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TicketType | null>(null);
  const [deleting, setDeleting] = useState<TicketType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchNames = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const preview = useCallback(
    (selected: string | null) => navigate(ticketTypeHref(path, state, { selected })),
    [navigate, path, state]
  );
  const typePath = useCallback(
    (id: string) => typePathTemplate.replace("__TYPE__", encodeURIComponent(id)),
    [typePathTemplate]
  );

  // A page past the end (a filter narrowed): the address follows the list.
  useEffect(() => {
    if (state.strona !== data.page) {
      window.history.replaceState(null, "", ticketTypeHref(path, state, { strona: data.page }));
    }
  }, [data.page, path, state]);

  // ↓ / ↑ open the next / previous type, Esc closes the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='listbox']"
        )
      ) {
        return;
      }
      if (event.key === "Escape" && state.selected) {
        event.preventDefault();
        preview(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!data.rows.length) return;
      const at = data.rows.findIndex((row) => row.id === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(data.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      preview(data.rows[next].id);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(data.rows[next].id)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.rows, preview, state.selected]);

  const openForm = (type: TicketType | null) => {
    setEditing(type);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteTicketTypeAction(deleting.id);
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      toast.success(labels.deleteSuccess);
      if (state.selected === deleting.id) preview(null);
      setDeleting(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "zakres",
      label: labels.scope,
      options: TYPE_SCOPES.map((value) => ({
        value,
        label: value === "org" ? labels.scopeOrg : labels.scopeBranch,
      })),
    },
    ...(branches.length
      ? [
          {
            kind: "list" as const,
            id: "oddzial",
            label: labels.branch,
            options: branches.map((b) => ({ value: b.id, label: b.name })),
          },
        ]
      : []),
    {
      kind: "list",
      id: "priorytet",
      label: labels.priority,
      options: TICKET_PRIORITIES.map((value) => ({
        value,
        label: labels[`priority_${value}`] ?? value,
      })),
    },
    {
      kind: "list",
      id: "akceptacja",
      label: labels.acceptance,
      options: YES_NO.map((value) => ({ value, label: labels[value] })),
    },
    {
      kind: "list",
      id: "stan",
      label: labels.status,
      options: TYPE_ACTIVITY.map((value) => ({
        value,
        label: value === "aktywne" ? labels.active : labels.inactive,
      })),
    },
  ];
  // The filters follow the columns (the branch sits with the scope).
  const order = ["name", ...layout.map((column) => column.id)].flatMap((id) =>
    id === "scope"
      ? ["zakres", "oddzial"]
      : id === "default_priority"
        ? ["priorytet"]
        : id === "acceptance"
          ? ["akceptacja"]
          : id === "status"
            ? ["stan"]
            : [id]
  );

  const selectedType = state.selected
    ? (types.find((type) => type.id === state.selected) ?? null)
    : null;

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
            <span className="text-xs tabular-nums text-muted-foreground">{data.totalCount}</span>
          </div>
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus className="mr-1.5 size-3.5" />
            {labels.create}
          </Button>
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={ticketTypeParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            order={order}
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <TicketTypesTable
            data={data}
            state={state}
            path={path}
            set={set}
            layout={layout}
            onLayoutChange={setLayout}
            widths={widths}
            cookie={cookie}
            labels={labels}
            branchNames={branchNames}
            typePath={typePath}
            onPreview={preview}
            onEdit={openForm}
            onDelete={setDeleting}
          />
          {state.selected ? (
            <aside
              aria-labelledby="ticket-type-panel-title"
              className="ks-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-2xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
            >
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <button
                  type="button"
                  onClick={() => preview(null)}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={labels.close}
                >
                  <X className="size-4" />
                  <span className="hidden sm:inline">{labels.title}</span>
                </button>
                <span className="text-muted-foreground/50">/</span>
                <span id="ticket-type-panel-title" className="truncate text-sm">
                  {selectedType?.name ?? "—"}
                </span>
                {selectedType ? (
                  <Link
                    href={typePath(selectedType.id)}
                    className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                  >
                    <ExternalLink className="size-3.5" />
                    {labels.viewType}
                  </Link>
                ) : null}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {selectedType ? (
                  <TicketTypeDetailPanel
                    key={selectedType.id}
                    type={selectedType}
                    priorityConfigs={priorityConfigs}
                    onEdit={openForm}
                    onDeleteRequest={() => setDeleting(selectedType)}
                    labels={labels}
                  />
                ) : (
                  <p className="p-8 text-center text-sm text-muted-foreground">{labels.notFound}</p>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      <TicketTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingType={editing}
        members={members}
        availableBranches={branches}
        priorityConfigs={priorityConfigs}
        onSaved={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? <strong className="text-foreground">{deleting.name}</strong> : null}{" "}
              {labels.deleteConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? labels.deleting : labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableNavigationProvider>
  );
}
