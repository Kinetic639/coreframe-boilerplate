"use client";

import { useCallback, useMemo } from "react";
import type { MentionItem } from "@repo/rich-text/mention-utils";
import { RichTextRenderer } from "@repo/rich-text/rich-text-renderer";
import type { RichTextRendererProps } from "@repo/rich-text/rich-text-types";
import { useMentionAccess } from "@/hooks/queries/mentions";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { MentionChip } from "./mention-chip";

/**
 * RichTextRenderer for one document (a description, a note) with Ambra's
 * mention chips: objects link only when the reader may open them. Lists of
 * documents (chat, comments) batch the access check themselves.
 */
export function RichTextWithMentions(props: Omit<RichTextRendererProps, "renderMention">) {
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const meId = useUserStoreV2((s) => s.user?.id ?? null);
  const documents = useMemo(() => (props.value ? [props.value] : []), [props.value]);
  const access = useMentionAccess(orgId, documents);
  const renderMention = useCallback(
    (mention: MentionItem) => (
      <MentionChip mention={mention} access={access(mention)} meId={meId} />
    ),
    [access, meId]
  );
  return <RichTextRenderer {...props} renderMention={renderMention} />;
}
