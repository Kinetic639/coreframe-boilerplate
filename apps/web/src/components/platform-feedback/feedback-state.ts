import {
  createLoader,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import type { ColumnSet } from "@/components/data-table/columns";
import { migrateDataViewParams, parseAsUuid } from "@/components/data-table/local-list";
import {
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  type ListFeedbackInput,
} from "@/lib/platform-feedback/types";

// A feedback list's whole state is its address: the search, the filters, the
// page, the report open in the side panel and (for the admin) the view. The
// database pages the reports, newest activity first; kind and priority filter
// by one value at a time, as the database does.

export const FEEDBACK_PAGE_SIZES = [20, 50, 100] as const;
export const FEEDBACK_VIEWS = ["lista", "tablica"] as const;

export const feedbackParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(FEEDBACK_PAGE_SIZES).withDefault(50),
  selected: parseAsUuid,
  status: parseAsArrayOf(parseAsStringLiteral(FEEDBACK_STATUSES)).withDefault([]),
  rodzaj: parseAsArrayOf(parseAsStringLiteral(FEEDBACK_KINDS)).withDefault([]),
  priorytet: parseAsArrayOf(parseAsStringLiteral(FEEDBACK_PRIORITIES)).withDefault([]),
  widok: parseAsStringLiteral(FEEDBACK_VIEWS).withDefault("lista"),
};

export type FeedbackState = inferParserType<typeof feedbackParsers>;
export type FeedbackScope = "mine" | "all";
export const loadFeedbackState = createLoader(feedbackParsers);
export const serializeFeedbackState = createSerializer(feedbackParsers);

export function feedbackHref(
  path: string,
  state: FeedbackState,
  patch: Partial<FeedbackState> = {}
) {
  return serializeFeedbackState(path, { ...state, ...patch });
}

/** What the database is asked for the page the address shows. */
export function feedbackListInput(scope: FeedbackScope, state: FeedbackState): ListFeedbackInput {
  return {
    scope,
    search: state.q.trim().slice(0, 200) || undefined,
    statuses: state.status.length ? [...state.status] : undefined,
    kind: state.rodzaj[0],
    priority: scope === "all" ? state.priorytet[0] : undefined,
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
  };
}

export const feedbackListKey = (scope: FeedbackScope, state: FeedbackState) =>
  ["platform-feedback", scope, "list", feedbackListInput(scope, state)] as const;

export function migrateFeedbackSearchParams(raw: Record<string, string | string[] | undefined>) {
  return migrateDataViewParams(raw, {
    status: { param: "status" },
    kind: { param: "rodzaj" },
    priority: { param: "priorytet" },
  });
}

export function feedbackColumnSet(
  scope: FeedbackScope,
  labels: Record<string, string>
): ColumnSet<string> {
  const ids =
    scope === "all" ? ["code", "status", "reporter", "activity"] : ["code", "status", "activity"];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: { code: 110, status: 220, reporter: 240, activity: 200 },
    shownByDefault: ids,
    pinned: { id: "title", label: labels.column_title, width: 360 },
  };
}

/** The list's words, built on the server from the "platformFeedback" messages. */
export function feedbackLabels(
  scope: FeedbackScope,
  t: (key: string) => string,
  locale: string
): Record<string, string> {
  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t(scope === "all" ? "pages.admin.title" : "pages.mine.title"),
    subtitle: t(scope === "all" ? "pages.admin.subtitle" : "pages.mine.subtitle"),
    column_title: t("columns.title"),
    column_code: t("columns.code"),
    column_status: t("columns.status"),
    column_reporter: t("columns.reporter"),
    column_activity: t("columns.activity"),
    filter_status: t("filters.status"),
    filter_kind: t("filters.kind"),
    filter_priority: t("filters.priority"),
    viewList: t("views.list"),
    viewBoard: t("views.board"),
    report: t("report.open"),
    search: pl ? "Szukaj tytułu, treści, numeru…" : "Search title, text, number…",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak zgłoszeń dla tych filtrów" : "No reports match these filters",
    emptyAll: pl ? "Nie ma jeszcze zgłoszeń" : "There are no reports yet",
    notFound: pl ? "Nie udało się wczytać zgłoszenia" : "Could not load the report",
    loadError: pl ? "Nie udało się wczytać zgłoszeń" : "Could not load the reports",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "zgłoszeń" : "reports",
  };
  for (const status of FEEDBACK_STATUSES) labels[`status_${status}`] = t(`status.${status}`);
  for (const kind of FEEDBACK_KINDS) labels[`kind_${kind}`] = t(`kind.${kind}`);
  for (const priority of FEEDBACK_PRIORITIES)
    labels[`priority_${priority}`] = t(`priority.${priority}`);
  return labels;
}
