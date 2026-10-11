"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { extractMentions, type MentionItem } from "@repo/rich-text/mention-utils";
import { normalizeRichText } from "@repo/rich-text/rich-text-utils";
import { listMentionPeopleAction, resolveMentionsAction } from "@/app/actions/mentions";
import {
  MENTION_OBJECT_TYPES,
  MENTION_PERSON,
  UUID_RE,
  mentionKey,
  type MentionPerson,
} from "@/lib/mentions";

export const mentionsKeys = {
  people: (orgId: string) => ["mentions", "people", orgId] as const,
  access: (orgId: string, keys: string[]) => ["mentions", "access", orgId, keys] as const,
};

/** Members of the organization that can be mentioned (the caller excluded) */
export function useMentionPeople(orgId: string | null | undefined) {
  return useQuery({
    queryKey: mentionsKeys.people(orgId ?? ""),
    queryFn: async (): Promise<MentionPerson[]> => {
      const result = await listMentionPeopleAction();
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
}

export type MentionAccess = "ok" | "denied" | "pending";

/**
 * Access of the viewer to the objects mentioned in some rich-text documents
 * (one batched server call per distinct set). People are always "ok".
 */
export function useMentionAccess(orgId: string | null | undefined, documents: readonly unknown[]) {
  const keys = useMemo(() => {
    const found = new Set<string>();
    for (const document of documents) {
      for (const mention of extractMentions(normalizeRichText(document))) {
        if (MENTION_OBJECT_TYPES.has(mention.type) && UUID_RE.test(mention.id)) {
          found.add(mentionKey(mention));
        }
      }
    }
    return [...found].sort();
  }, [documents]);

  const query = useQuery({
    queryKey: mentionsKeys.access(orgId ?? "", keys),
    queryFn: async (): Promise<Set<string>> => {
      const refs = keys.map((key) => {
        const [type, id] = key.split(":");
        return { type, id };
      });
      const result = await resolveMentionsAction(refs);
      if (!result.success) throw new Error((result as { error: string }).error);
      return new Set(result.data);
    },
    enabled: !!orgId && keys.length > 0,
    staleTime: 60_000,
    // Chips keep their state while a new message adds one more object to the set
    placeholderData: (previous) => previous,
  });

  const readable = query.data;
  const settled = query.isSuccess || query.isError;
  return useCallback(
    (mention: MentionItem): MentionAccess => {
      if (mention.type === MENTION_PERSON) return "ok";
      if (!MENTION_OBJECT_TYPES.has(mention.type)) return "denied";
      if (readable?.has(mentionKey(mention))) return "ok";
      // Not in the answered set: no access (or the object is gone)
      return settled && !query.isPlaceholderData ? "denied" : "pending";
    },
    [query.isPlaceholderData, readable, settled]
  );
}
