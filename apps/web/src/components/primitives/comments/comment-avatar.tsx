"use client";

import { UserAvatar } from "@/components/primitives/avatar";
import { cn } from "@/utils";
import type { CommentAuthor, CommentDensity } from "./comment-types";

interface CommentAvatarProps {
  author?: CommentAuthor;
  density: CommentDensity;
  className?: string;
}

export function CommentAvatar({ author, density, className }: CommentAvatarProps) {
  return (
    <UserAvatar
      src={author?.avatarUrl}
      alt={author?.name}
      fullName={author?.name}
      fallback={author?.fallback}
      email={author?.email}
      profileHref={author?.profileHref}
      profileLabel={author?.profileLabel}
      disabledPopover={!author}
      className={cn(density === "compact" ? "h-8 w-8" : "h-9 w-9", className)}
      fallbackClassName="bg-primary/10 text-xs font-semibold text-primary"
    />
  );
}
