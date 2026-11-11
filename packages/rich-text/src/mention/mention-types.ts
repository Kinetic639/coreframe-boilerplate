import type { ForwardRefExoticComponent, RefAttributes } from "react";

/**
 * What a mention points at. `type` is "person" or an object type of the host
 * app (repair order, item, ticket, …); the package does not interpret it.
 * `label` and `code` are stored as they were when the mention was inserted.
 */
export interface MentionItem {
  type: string;
  id: string;
  label: string;
  /** Number / code of an object (ZL number, SKU, HD-000014) */
  code?: string | null;
  /** Where the object opens, as the app resolved it at insert time */
  href?: string | null;
}

/** Props of the suggestion list the host app renders while the user types after "@" */
export interface MentionSuggestionListProps {
  /** Text typed after "@" */
  query: string;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

/** The list handles its own keys (arrows, Enter, Tab); true = handled */
export interface MentionSuggestionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export type MentionSuggestionListComponent = ForwardRefExoticComponent<
  MentionSuggestionListProps & RefAttributes<MentionSuggestionListHandle>
>;

/**
 * Mentions for an editor. The package owns the node and the popup mechanics;
 * the app owns what can be mentioned and how results look.
 */
export interface MentionOptions {
  SuggestionList: MentionSuggestionListComponent;
}

export const MENTION_NODE = "mention";
