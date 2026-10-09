"use client";

import { create } from "zustand";

/**
 * Messages UI state: the right bar (collapsed rail / expanded list) and the
 * Messenger-style chat windows docked at the bottom. Saved per user and
 * organization in localStorage, so windows survive navigation and reloads.
 */

export const MAX_CHAT_WINDOWS = 3;

export interface ChatWindowState {
  conversationId: string;
  /** Collapsed to its header bar */
  collapsed: boolean;
}

interface PersistedChatUi {
  expanded: boolean;
  windows: ChatWindowState[];
}

interface ChatWindowsStore extends PersistedChatUi {
  storageKey: string | null;
  /** Loads the saved state of a user + organization (call once they are known) */
  hydrate: (userId: string, orgId: string) => void;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  /** Opens (or brings to the front, expanded) a conversation's window; newest on the right */
  openWindow: (conversationId: string, options?: { collapsed?: boolean }) => void;
  toggleCollapsed: (conversationId: string) => void;
  closeWindow: (conversationId: string) => void;
}

const EMPTY: PersistedChatUi = { expanded: false, windows: [] };

function read(key: string): PersistedChatUi {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistedChatUi>;
    const windows = Array.isArray(parsed.windows)
      ? parsed.windows
          .filter(
            (w): w is ChatWindowState =>
              !!w && typeof w.conversationId === "string" && typeof w.collapsed === "boolean"
          )
          .slice(0, MAX_CHAT_WINDOWS)
      : [];
    return { expanded: parsed.expanded === true, windows };
  } catch {
    return EMPTY;
  }
}

function write(key: string | null, state: PersistedChatUi) {
  if (!key) return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ expanded: state.expanded, windows: state.windows })
    );
  } catch {
    // Storage unavailable: the state lives for this page only
  }
}

export const useChatWindowsStore = create<ChatWindowsStore>((set, get) => {
  const update = (next: Partial<PersistedChatUi>) => {
    set(next);
    const { storageKey, expanded, windows } = get();
    write(storageKey, { expanded, windows });
  };

  return {
    ...EMPTY,
    storageKey: null,
    hydrate: (userId, orgId) => {
      const storageKey = `ambra:chat-ui:${userId}:${orgId}`;
      if (get().storageKey === storageKey) return;
      set({ storageKey, ...read(storageKey) });
    },
    setExpanded: (expanded) => update({ expanded }),
    toggleExpanded: () => update({ expanded: !get().expanded }),
    openWindow: (conversationId, options) => {
      const others = get().windows.filter((w) => w.conversationId !== conversationId);
      const windows = [...others, { conversationId, collapsed: options?.collapsed ?? false }].slice(
        -MAX_CHAT_WINDOWS
      );
      update({ windows });
    },
    toggleCollapsed: (conversationId) =>
      update({
        windows: get().windows.map((w) =>
          w.conversationId === conversationId ? { ...w, collapsed: !w.collapsed } : w
        ),
      }),
    closeWindow: (conversationId) =>
      update({ windows: get().windows.filter((w) => w.conversationId !== conversationId) }),
  };
});
