"use client";

import { createContext, useContext } from "react";
import type { SearchSourceId } from "@/lib/global-search/sources";

export interface MentionScope {
  /** People listed first (e.g. members of the conversation, people on the ticket) */
  priorityUserIds?: ReadonlySet<string>;
  /** Narrows the mentionable object sources for one editor */
  sources?: readonly SearchSourceId[];
}

const MentionScopeContext = createContext<MentionScope>({});

/** Wraps an editor to tell its "@" list who is closest to the text being written */
export const MentionScopeProvider = MentionScopeContext.Provider;

export function useMentionScope(): MentionScope {
  return useContext(MentionScopeContext);
}
