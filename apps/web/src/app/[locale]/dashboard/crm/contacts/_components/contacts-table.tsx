import { ArrowDown, ArrowUp, ChevronsUpDown, Eye } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { TableLink as PageLink } from "@/components/kolor-sensu/data-table/table-navigation";
import {
  DataTable,
  TablePagination,
  pageState,
  TD,
} from "@/components/kolor-sensu/data-table/data-table";
import { ColumnsMenu } from "@/components/kolor-sensu/data-table/columns-menu";
import {
  defaultLayout,
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { RowActions, RowActionLink } from "@/components/kolor-sensu/row-actions";
import { Badge } from "@/components/ui/badge";
import { ChatAvatar } from "@/components/v2/messages/chat-avatar";
import { memberInitials } from "@/lib/messages/display";
import type { ContactDirectoryPage, ContactDirectoryRow } from "@/lib/contacts/types";
import { cn } from "@/lib/utils";
import { contactHref, CONTACT_PAGE_SIZES, type ContactState } from "./contacts-state";

type Row = ContactDirectoryRow;

export function contactColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = ["kind", "email", "phone", "job_title", "branch"];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: { kind: 140, email: 240, phone: 160, job_title: 180, branch: 160 },
    shownByDefault: ids,
    pinned: { id: "contact", label: labels.column_contact, width: 280 },
  };
}

/** An employee, or an external contact with its visibility. */
export function ContactKind({ row, labels }: { row: Row; labels: Record<string, string> }) {
  return row.kind === "member" ? (
    <Badge className="bg-primary/10 font-normal text-primary hover:bg-primary/10">
      {labels.kind_member}
    </Badge>
  ) : (
    <Badge variant="outline" className="font-normal">
      {row.visibility_scope ? labels[`visibility_${row.visibility_scope}`] : labels.kind_external}
    </Badge>
  );
}

export function ContactsTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  loading,
  refreshing,
  error,
  onRetry,
  onLayoutChange,
  onPreview,
  onPrefetch,
}: {
  data: ContactDirectoryPage;
  state: ContactState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  /** Nothing to show yet (no rows of this address in the cache). */
  loading: boolean;
  /** The rows shown are an older address's, new ones are coming. */
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (key: string | null) => void;
  /** The pointer rests on a row (null: it left): its card can be fetched. */
  onPrefetch: (key: string | null) => void;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<ContactState>) => contactHref(path, state, patch);
  const rowHref = (row: Row) => href({ selected: state.selected === row.key ? null : row.key });
  const openPreview = (event: MouseEvent, row: Row) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.key ? null : row.key);
  };
  const nameSort = {
    href: href({
      direction: state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.direction,
  };
  const NameSortIcon =
    nameSort.direction === "asc"
      ? ArrowUp
      : nameSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  const menu = (
    <ColumnsMenu
      cookie={cookie}
      defaults={defaultLayout(set)}
      labels={set.labels}
      layout={layout}
      onChange={onLayoutChange}
      pinnedLabel={set.pinned.label}
    />
  );
  const actions = (row: Row) => (
    <RowActions label={row.display_name}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
    </RowActions>
  );
  const value = (row: Row, id: string): ReactNode => {
    switch (id) {
      case "kind":
        return <ContactKind row={row} labels={labels} />;
      case "email":
        return row.email || "—";
      case "phone":
        return row.phone || row.mobile || "—";
      case "job_title":
        return row.job_title || "—";
      case "branch":
        return row.branch_name || "—";
      default:
        return "—";
    }
  };
  const pagination = (
    <TablePagination
      sizes={CONTACT_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const identity = (row: Row) => (
    <>
      <ChatAvatar
        initials={memberInitials(row)}
        src={row.avatar_url}
        size={28}
        ringClassName="ring-background"
        className="shrink-0"
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium" title={row.display_name}>
          {row.display_name}
        </span>
        <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
          {row.job_title || row.email || "—"}
        </span>
      </span>
    </>
  );
  const linkProps = (row: Row) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
    onMouseEnter: () => onPrefetch(row.key),
    onMouseLeave: () => onPrefetch(null),
    onFocus: () => onPrefetch(row.key),
  });
  const empty = loading
    ? labels.loading
    : error
      ? labels.loadError
      : state.q || state.rodzaj.length
        ? labels.empty
        : labels.emptyAll;
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "ks-list-pane--preview"
      )}
      aria-busy={loading || refreshing}
      data-refreshing={refreshing ? "" : undefined}
    >
      {loading || refreshing ? (
        <div className="ks-list-progress" role="progressbar" aria-label={labels.loading} />
      ) : null}
      {error ? (
        <div role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {labels.loadError} <span className="block text-xs">{error}</span>
          <button type="button" onClick={onRetry} className="underline">
            {labels.retry}
          </button>
        </div>
      ) : null}
      {state.selected ? (
        <aside
          className="ks-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            <PageLink
              href={nameSort.href}
              scroll={false}
              className="inline-flex items-center gap-1 rounded text-foreground hover:text-foreground"
            >
              {set.pinned.label}
              <NameSortIcon className="size-3" aria-hidden="true" />
            </PageLink>
          </header>
          <ul>
            {data.rows.map((row) => {
              const selected = row.key === state.selected;
              return (
                <li key={row.key} data-row-id={row.key}>
                  <PageLink
                    {...linkProps(row)}
                    className={cn(
                      "group flex h-[49px] items-center gap-2.5 border-b px-3 py-1 hover:bg-muted/50",
                      selected &&
                        "border-l-[3px] border-l-primary bg-primary/10 pl-[9px] hover:bg-primary/10"
                    )}
                    aria-current={selected ? "true" : undefined}
                  >
                    {identity(row)}
                  </PageLink>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : (
        <div className="ks-list-desktop-table min-h-0 flex-1 flex-col">
          <DataTable
            caption={labels.title}
            set={set}
            columns={shown.map((id) => ({ id, label: set.labels[id] }))}
            rows={data.rows}
            rowKey={(row) => row.key}
            rowHref={rowHref}
            selected={(row) => row.key === state.selected}
            pinnedSort={nameSort}
            onRowIntent={(row) => onPrefetch(row ? row.key : null)}
            pinned={(row) => (
              <PageLink {...linkProps(row)} className="flex min-w-0 items-center gap-2.5 py-1">
                {identity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td
                key={id}
                className={cn(TD, id === "branch" || id === "phone" ? "text-muted-foreground" : "")}
              >
                {value(row, id)}
              </td>
            )}
            actions={actions}
            menu={menu}
            widths={widths}
            widthsCookie={`${cookie}_widths`}
            empty={empty}
            pagination={pagination}
          />
        </div>
      )}
      <div className="ks-list-mobile min-h-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs text-muted-foreground">
          <span>
            {data.totalCount} {labels.countSuffix}
          </span>
          <div className="flex items-center gap-2">
            <PageLink href={nameSort.href}>
              {labels.column_contact} {nameSort.direction === "asc" ? "↑" : "↓"}
            </PageLink>
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {data.rows.map((row) => (
            <li key={row.key} className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30">
              <PageLink {...linkProps(row)} className="flex min-w-0 flex-1 items-start gap-2.5">
                {identity(row)}
                <span className="ml-auto shrink-0">
                  <ContactKind row={row} labels={labels} />
                </span>
              </PageLink>
              <div className="ml-1 shrink-0">{actions(row)}</div>
            </li>
          ))}
          {!data.rows.length ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{empty}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
