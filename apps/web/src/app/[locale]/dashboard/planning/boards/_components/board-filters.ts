import type { KanbanBoardCard } from "@/lib/types/kanban";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs";

// Filters of a board, kept in the address (?q=…&osoby=me,none&etykiety=…),
// so a filtered view can be shared and Back undoes a filter.

export const DUE_FILTERS = ["overdue", "soon", "week", "none"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

/** "me" is the viewer, "none" a task nobody has; anything else a user id. */
export const ME = "me";
export const NOBODY = "none";

export const boardFilterParams = {
  q: parseAsString.withDefault(""),
  osoby: parseAsArrayOf(parseAsString).withDefault([]),
  etykiety: parseAsArrayOf(parseAsString).withDefault([]),
  termin: parseAsStringLiteral(DUE_FILTERS),
  priorytet: parseAsArrayOf(parseAsString).withDefault([]),
};

export interface BoardFilters {
  q: string;
  people: string[];
  labels: string[];
  due: DueFilter | null;
  priority: string[];
}

export const NO_FILTERS: BoardFilters = { q: "", people: [], labels: [], due: null, priority: [] };

export function hasActiveFilters(filters: BoardFilters): boolean {
  return Boolean(
    filters.q.trim() ||
    filters.people.length ||
    filters.labels.length ||
    filters.due ||
    filters.priority.length
  );
}

/** How many filter groups are on (the search does not count). */
export function activeFilterCount(filters: BoardFilters): number {
  return (
    (filters.people.length ? 1 : 0) +
    (filters.labels.length ? 1 : 0) +
    (filters.due ? 1 : 0) +
    (filters.priority.length ? 1 : 0)
  );
}

function localDay(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000)
  );
}

function matchesDue(card: KanbanBoardCard, due: DueFilter, now: Date): boolean {
  if (due === "none") return !card.due_at;
  if (!card.due_at) return false;
  if (card.status === "completed" || card.status === "cancelled") return false;
  const at = new Date(card.due_at);
  if (Number.isNaN(at.getTime())) return false;
  const days = localDay(at) - localDay(now);
  if (due === "overdue") return card.due_has_time ? at.getTime() < now.getTime() : days < 0;
  if (due === "soon") return days >= 0 && days <= 1;
  return days >= 0 && days <= 7;
}

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

/**
 * Whether a card passes the filters. Groups combine with AND, the choices
 * inside a group with OR (a card with any of the picked labels passes).
 */
export function cardMatches(
  card: KanbanBoardCard,
  filters: BoardFilters,
  currentUserId: string,
  now: Date = new Date()
): boolean {
  const query = normalize(filters.q.trim());
  if (query) {
    const haystack = normalize(
      [
        card.title,
        card.task_number,
        card.description ?? "",
        card.assignee_name ?? "",
        card.label ?? "",
        ...(card.labels ?? []).map((label) => label.name),
      ].join(" ")
    );
    if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  if (filters.people.length) {
    const ok = filters.people.some((person) => {
      if (person === NOBODY) return !card.assigned_to;
      if (person === ME) return card.assigned_to === currentUserId;
      return card.assigned_to === person;
    });
    if (!ok) return false;
  }
  if (filters.labels.length) {
    const ids = new Set((card.labels ?? []).map((label) => label.id));
    if (!filters.labels.some((id) => ids.has(id))) return false;
  }
  if (filters.priority.length && !filters.priority.includes(card.priority)) return false;
  if (filters.due && !matchesDue(card, filters.due, now)) return false;
  return true;
}

export function filterCards(
  cards: KanbanBoardCard[],
  filters: BoardFilters,
  currentUserId: string,
  now: Date = new Date()
): KanbanBoardCard[] {
  if (!hasActiveFilters(filters)) return cards;
  return cards.filter((card) => cardMatches(card, filters, currentUserId, now));
}

/**
 * A drop in a filtered column gives an index among the cards shown; the
 * move needs the index among all of the column's cards (hidden ones too).
 * Both lists leave out the card being moved. The card lands just before the
 * shown card it was dropped above, or just after the last shown card.
 */
export function fullIndexFromVisible(
  fullIds: string[],
  visibleIds: string[],
  visibleIndex: number
): number {
  if (!visibleIds.length) return fullIds.length;
  if (visibleIndex < visibleIds.length) {
    const before = fullIds.indexOf(visibleIds[Math.max(0, visibleIndex)]);
    return before === -1 ? fullIds.length : before;
  }
  const last = fullIds.indexOf(visibleIds[visibleIds.length - 1]);
  return last === -1 ? fullIds.length : last + 1;
}
