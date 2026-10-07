"use client";

import { CommentRenderer as SharedCommentRenderer } from "@repo/rich-text/comments";
import { CommentAvatar } from "./comment-avatar";
import type { CommentRendererProps } from "./comment-types";

/** Shared renderer (@repo/rich-text) with Ambra's UserAvatar (profile popover). */
export function CommentRenderer(props: CommentRendererProps) {
  return (
    <SharedCommentRenderer
      {...props}
      avatar={
        props.avatar ?? <CommentAvatar author={props.author} density={props.density ?? "default"} />
      }
    />
  );
}
