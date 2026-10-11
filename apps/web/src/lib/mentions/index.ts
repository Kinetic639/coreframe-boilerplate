import type { JSONContent } from "@tiptap/core";
import type { MentionItem } from "@repo/rich-text/mention-utils";
import { scoreSearchMatch } from "@/lib/global-search/match";
import type { SearchSourceId } from "@/lib/global-search/sources";
import type { ExactHitType, SearchExactHit } from "@/server/services/global-search.service";

/**
 * "@" mentions of people and objects — the pure part shared by the suggestion
 * list, the chips and the server actions. Objects come from the global search
 * (Ctrl+K) engine; people from the organization's member list.
 */

export const MENTION_PERSON = "person";

/** Search sources that can be mentioned, in tab order; an editor may narrow the list */
export const MENTION_SOURCES: SearchSourceId[] = [
  "repairOrders",
  "items",
  "tickets",
  "tasks",
  "documents",
  "containers",
  "locations",
  "parties",
  "contacts",
];

/** Hit type each mentionable source returns */
export const MENTION_SOURCE_TYPES: Partial<Record<SearchSourceId, ExactHitType>> = {
  repairOrders: "repairOrder",
  items: "item",
  tickets: "ticket",
  tasks: "task",
  documents: "document",
  containers: "container",
  locations: "location",
  parties: "party",
  contacts: "contact",
};

export const MENTION_OBJECT_TYPES: ReadonlySet<string> = new Set(
  Object.values(MENTION_SOURCE_TYPES)
);

export interface MentionPerson {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
}

export interface MentionRef {
  type: string;
  id: string;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mentionKey(ref: MentionRef): string {
  return `${ref.type}:${ref.id}`;
}

export function personName(person: Pick<MentionPerson, "firstName" | "lastName" | "email">) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.email || "";
}

export function personMention(person: MentionPerson): MentionItem {
  return { type: MENTION_PERSON, id: person.userId, label: personName(person) };
}

/** A search hit as a mention: the number / code is what the text shows */
export function hitMention(hit: SearchExactHit): MentionItem {
  const search = hit.query ? `?${new URLSearchParams(hit.query).toString()}` : "";
  return {
    type: hit.type,
    id: hit.id,
    label: hit.title ?? hit.code ?? "",
    code: hit.code,
    href: `${hit.href}${search}`,
  };
}

/**
 * Where a stored mention may link: an internal dashboard path only. The href
 * comes from message content, so anything else (other origins, javascript:) is dropped.
 */
export function mentionRoute(
  href: string | null | undefined
): { pathname: string; query?: Record<string, string> } | null {
  if (!href || !/^\/dashboard\/[^\s\\]*$/.test(href) || href.includes("//")) return null;
  const [pathname, search] = href.split("?", 2);
  if (!search) return { pathname };
  return { pathname, query: Object.fromEntries(new URLSearchParams(search.split("#")[0])) };
}

/**
 * People matching the typed text (name or e-mail, from the first letter),
 * `priorityIds` (e.g. members of the conversation) first, then by name.
 */
export function filterMentionPeople(
  people: readonly MentionPerson[],
  text: string,
  priorityIds: ReadonlySet<string>,
  limit: number
): MentionPerson[] {
  return people
    .map((person) => ({
      person,
      score: scoreSearchMatch(text, personName(person), person.email ? [person.email] : []),
      priority: priorityIds.has(person.userId) ? 1 : 0,
    }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        b.score - a.score ||
        personName(a.person).localeCompare(personName(b.person), "pl")
    )
    .slice(0, limit)
    .map((row) => row.person);
}

const PLAIN_NODES = new Set(["doc", "paragraph", "text", "hardBreak"]);

/** True when a document is only text and line breaks (no mentions, no formatting) */
export function isPlainDocument(node: JSONContent | null | undefined): boolean {
  if (!node) return true;
  if (!PLAIN_NODES.has(node.type ?? "") || node.marks?.length) return false;
  return (node.content ?? []).every(isPlainDocument);
}

// ---------------------------------------------------------------------------
// Recently mentioned objects (per organization, this browser)
// ---------------------------------------------------------------------------

const RECENT_LIMIT = 6;
const recentKey = (orgId: string) => `ambra:mentions:recent:${orgId}`;

export function readRecentMentions(orgId: string): MentionItem[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(recentKey(orgId)) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item): item is MentionItem =>
          !!item &&
          typeof (item as MentionItem).id === "string" &&
          typeof (item as MentionItem).type === "string" &&
          typeof (item as MentionItem).label === "string"
      )
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function rememberMention(orgId: string, item: MentionItem): void {
  if (item.type === MENTION_PERSON) return;
  try {
    const rest = readRecentMentions(orgId).filter(
      (other) => mentionKey(other) !== mentionKey(item)
    );
    window.localStorage.setItem(
      recentKey(orgId),
      JSON.stringify([item, ...rest].slice(0, RECENT_LIMIT))
    );
  } catch {
    // Storage unavailable (private mode): the list simply has no "recent" rows
  }
}
