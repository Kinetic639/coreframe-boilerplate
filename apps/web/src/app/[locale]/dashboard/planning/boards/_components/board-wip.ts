import type { KanbanBoardCard } from "@/lib/types/kanban";

// A soft limit of cards per list (work in progress). Nothing is refused: the
// list's count turns red and a move past the limit gets a warning. Template
// cards sit in a list only to be copied, so they never count.

/** How many cards of a list count toward its limit. */
export function wipCount(cards: KanbanBoardCard[], columnId: string): number {
  let count = 0;
  for (const card of cards) {
    if (!card.is_inbox && card.column_id === columnId && !card.is_template) count += 1;
  }
  return count;
}

/**
 * Whether moving a card into a list takes it past its limit. A move inside
 * the same list, or of a template card, changes nothing.
 */
export function moveExceedsWip(
  cards: KanbanBoardCard[],
  card: KanbanBoardCard,
  columnId: string,
  limit: number | null
): boolean {
  if (!limit || card.is_template) return false;
  if (!card.is_inbox && card.column_id === columnId) return false;
  return wipCount(cards, columnId) + 1 > limit;
}
