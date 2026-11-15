import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionLink } from "@/components/data-table/row-actions";
import { Badge } from "@/components/ui/badge";
import { ChatAvatar } from "@/components/v2/messages/chat-avatar";
import { memberInitials } from "@/lib/messages/display";
import type { ContactDirectoryPage, ContactDirectoryRow } from "@/lib/contacts/types";
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
  const href = (patch: Partial<ContactState>) => contactHref(path, state, patch);
  const rowHref = (row: Row) => href({ selected: state.selected === row.key ? null : row.key });
  const nameSort = {
    href: href({
      direction: state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.direction,
  };
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
  const empty = loading
    ? labels.loading
    : error
      ? labels.loadError
      : state.q || state.rodzaj.length
        ? labels.empty
        : labels.emptyAll;
  return (
    <ListPane
      rows={data.rows}
      totalCount={data.totalCount}
      page={state.strona}
      size={state.wierszy}
      sizes={CONTACT_PAGE_SIZES}
      selected={state.selected}
      rowKey={(row) => row.key}
      rowHref={rowHref}
      pageHref={(page) => href({ strona: page, selected: null })}
      sizeHref={(size) =>
        href({ wierszy: size as ContactState["wierszy"], strona: 1, selected: null })
      }
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={() => undefined}
      pinnedSort={nameSort}
      identity={identity}
      value={value}
      badge={(row) => <ContactKind row={row} labels={labels} />}
      cardHidden={["kind"]}
      actions={actions}
      cellClassName={(id) =>
        id === "branch" || id === "phone" ? "text-muted-foreground" : undefined
      }
      labels={labels}
      empty={empty}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      onPreview={onPreview}
      onPrefetch={onPrefetch}
    />
  );
}
