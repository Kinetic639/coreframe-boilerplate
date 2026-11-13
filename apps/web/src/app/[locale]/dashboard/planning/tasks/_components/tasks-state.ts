import {
  createLoader,
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import type { DataViewListParams } from "@/lib/data-view/types";
import type { TaskListFilters } from "@/lib/validations/planning";

// The task list's whole state is its address: the view (list or board), the
// search, a filter per column, the sort, the page and the task open in the
// side panel (the board's dialog).

export const TASK_PAGE_SIZES = [20, 50, 100] as const;
export const TASK_SORTS = ["task_number", "title", "due_at", "created_at", "updated_at"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];
export const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TASK_VIEWS = ["lista", "tablica"] as const;
/** Ready ranges of the due date filter. */
export const DUE_WITHIN = ["po_terminie", "dzis", "7d"] as const;
/** The assignee filter's value for tasks nobody has. */
export const UNASSIGNED = "brak";
/** The branch filter's value for organization-wide tasks. */
export const ORG_WIDE = "organizacja";

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** A day, `2026-11-12` (anything else is dropped). */
const parseAsDay = createParser({
  parse: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});
/** A person's id, or "brak". */
const parseAsAssignee = createParser({
  parse: (value) => (value === UNASSIGNED || UUID.test(value) ? value : null),
  serialize: (value: string) => value,
});
/** A branch's id, or "organizacja". */
const parseAsBranch = createParser({
  parse: (value) => (value === ORG_WIDE || UUID.test(value) ? value : null),
  serialize: (value: string) => value,
});

export const taskParsers = {
  widok: parseAsStringLiteral(TASK_VIEWS).withDefault("lista"),
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(TASK_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(TASK_SORTS).withDefault("created_at"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  /** The open task: its number (`TSK-0042`). */
  selected: createParser({
    parse: (value) => (/^[\w\-./]{1,60}$/.test(value) ? value : null),
    serialize: (value: string) => value,
  }),
  status: parseAsArrayOf(parseAsStringLiteral(TASK_STATUSES)).withDefault([]),
  priorytet: parseAsArrayOf(parseAsStringLiteral(TASK_PRIORITIES)).withDefault([]),
  przypisani: parseAsArrayOf(parseAsAssignee).withDefault([]),
  oddzial: parseAsArrayOf(parseAsBranch).withDefault([]),
  termin: parseAsStringLiteral(DUE_WITHIN),
  termin_od: parseAsDay,
  termin_do: parseAsDay,
};

export type TaskState = inferParserType<typeof taskParsers>;
export const loadTaskState = createLoader(taskParsers);
export const serializeTaskState = createSerializer(taskParsers);

export function taskHref(path: string, state: TaskState, patch: Partial<TaskState> = {}) {
  return serializeTaskState(path, { ...state, ...patch });
}

/** A UTC day `days` after today's. */
function dayFrom(today: Date, days: number) {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** The due window the address asks for, as whole days (from, to; both included). */
export function dueWindow(
  state: Pick<TaskState, "termin" | "termin_od" | "termin_do">,
  today = new Date()
): { from: string | null; to: string | null } {
  if (state.termin_od || state.termin_do) {
    return { from: state.termin_od, to: state.termin_do };
  }
  switch (state.termin) {
    case "po_terminie":
      return { from: null, to: dayFrom(today, -1) };
    case "dzis":
      return { from: dayFrom(today, 0), to: dayFrom(today, 0) };
    case "7d":
      return { from: dayFrom(today, 0), to: dayFrom(today, 7) };
    default:
      return { from: null, to: null };
  }
}

/** The filters the address sets (the board applies the same ones in place). */
export function taskFilters(state: TaskState, today = new Date()): TaskListFilters {
  const due = dueWindow(state, today);
  return {
    status: state.status.length ? [...state.status] : undefined,
    priority: state.priorytet.length ? [...state.priorytet] : undefined,
    assignees: state.przypisani.filter((value) => value !== UNASSIGNED),
    unassigned: state.przypisani.includes(UNASSIGNED) || undefined,
    branch_ids: state.oddzial.filter((value) => value !== ORG_WIDE),
    org_wide: state.oddzial.includes(ORG_WIDE) || undefined,
    due_from: due.from ? `${due.from}T00:00:00.000Z` : undefined,
    // The whole last day counts.
    due_to: due.to ? `${due.to}T23:59:59.999Z` : undefined,
  };
}

/** What the list asks the service for (the panel and the view are not part of it). */
export function taskListParams(state: TaskState): DataViewListParams {
  return {
    search: state.q.trim().slice(0, 100),
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
    sort: { field: state.sort, direction: state.direction },
    filters: {},
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters={...}`) and QR links (`highlight`) are translated once into this
 * list's address. `selected` keeps its name.
 */
export function migrateTaskSearchParams(raw: Record<string, string | string[] | undefined>) {
  const next = { ...raw };
  let changed = false;
  for (const [oldKey, newKey] of [
    ["search", "q"],
    ["page", "strona"],
    ["pageSize", "wierszy"],
    ["highlight", "selected"],
  ]) {
    if (raw[oldKey] !== undefined) {
      next[newKey] ??= raw[oldKey];
      delete next[oldKey];
      changed = true;
    }
  }
  if (typeof raw.sort === "string" && raw.sort.includes(".")) {
    const [field, direction] = raw.sort.split(".");
    next.sort = field;
    next.direction = direction;
    changed = true;
  }
  if (typeof raw.filters === "string") {
    try {
      const filters = JSON.parse(raw.filters) as Record<string, unknown>;
      if (filters && typeof filters === "object" && !Array.isArray(filters)) {
        for (const [oldKey, newKey] of [
          ["status", "status"],
          ["priority", "priorytet"],
        ]) {
          const value = filters[oldKey];
          if (typeof value === "string" || Array.isArray(value)) {
            next[newKey] ??= Array.isArray(value) ? value.join(",") : value;
          }
        }
        if (typeof filters.assigned_to === "string") next.przypisani ??= filters.assigned_to;
        if (filters.assigned_to === null) next.przypisani ??= UNASSIGNED;
        if (typeof filters.branch_id === "string") next.oddzial ??= filters.branch_id;
        if (filters.branch_id === null) next.oddzial ??= ORG_WIDE;
      }
    } catch {
      /* The parsers drop what they cannot read. */
    }
    delete next.filters;
    changed = true;
  }
  return { params: next, changed };
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "ł" has no accent to strip.
    .replace(/ł/g, "l");

/** Whether a task is one the address asks for (the board filters in place). */
export function taskMatches(
  task: {
    task_number: string;
    title: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    assignee_name: string | null;
    assignee_email: string | null;
    branch_id: string | null;
    due_at: string | null;
  },
  state: TaskState,
  today = new Date()
) {
  const filters = taskFilters(state, today);
  if (filters.status && !filters.status.includes(task.status as never)) return false;
  if (filters.priority && !filters.priority.includes(task.priority as never)) return false;
  if (filters.assignees?.length || filters.unassigned) {
    const mine = task.assigned_to
      ? !!filters.assignees?.includes(task.assigned_to)
      : !!filters.unassigned;
    if (!mine) return false;
  }
  if (filters.branch_ids?.length || filters.org_wide) {
    const inside = task.branch_id
      ? !!filters.branch_ids?.includes(task.branch_id)
      : !!filters.org_wide;
    if (!inside) return false;
  }
  if (filters.due_from || filters.due_to) {
    if (!task.due_at) return false;
    if (filters.due_from && task.due_at < filters.due_from) return false;
    if (filters.due_to && task.due_at > filters.due_to) return false;
  }
  const search = fold(state.q.trim());
  if (!search) return true;
  return [task.task_number, task.title, task.assignee_name, task.assignee_email]
    .filter((value): value is string => !!value)
    .some((value) => fold(value).includes(search));
}
