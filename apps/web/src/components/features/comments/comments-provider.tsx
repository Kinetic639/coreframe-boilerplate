"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CommentDensity } from "@/components/primitives/comments";

export interface CommentsLabels {
  title?: string;
  empty?: string;
  placeholder?: string;
  submit?: string;
  submitting?: string;
  loadMore?: string;
  edited?: string;
  formerMember?: string;
}

export interface CommentsProviderValue {
  targetType: string;
  targetId: string;
  canComment?: boolean;
  density?: CommentDensity;
  pageSize?: number;
  labels?: CommentsLabels;
}

const CommentsContext = createContext<CommentsProviderValue | null>(null);

export function CommentsProvider({
  children,
  ...value
}: CommentsProviderValue & { children: ReactNode }) {
  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

export function useCommentsProvider(): CommentsProviderValue | null {
  return useContext(CommentsContext);
}
