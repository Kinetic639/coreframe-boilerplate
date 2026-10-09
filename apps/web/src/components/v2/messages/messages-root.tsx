"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { MESSAGES_USE } from "@/lib/constants/permissions";
import { useChatWindowsStore } from "@/lib/stores/v2/chat-windows-store";
import { getUserDisplayName } from "@/utils/user-helpers";
import { ChatProvider, useChat } from "./chat-provider";
import { ChatWindow } from "./chat-window";
import {
  MESSAGES_BAR_COLLAPSED_WIDTH,
  MESSAGES_BAR_EXPANDED_WIDTH,
  MessagesBar,
} from "./messages-bar";

/** Height of the dashboard status bar the windows sit above */
const STATUS_BAR_HEIGHT = 32;

/**
 * Messages for the whole dashboard: realtime provider, the right bar and the
 * docked chat windows. Renders the page content only for users without
 * `messages.use` (or before the organization is known).
 */
export function MessagesRoot({ children }: { children: ReactNode }) {
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const user = useUserStoreV2((s) => s.user);
  const { can } = usePermissions();
  const hydrate = useChatWindowsStore((s) => s.hydrate);
  const allowed = !!orgId && !!user?.id && can(MESSAGES_USE);

  useEffect(() => {
    if (allowed && user?.id && orgId) hydrate(user.id, orgId);
  }, [allowed, hydrate, orgId, user?.id]);

  if (!allowed || !orgId || !user?.id) return <>{children}</>;

  return (
    <ChatProvider
      orgId={orgId}
      meId={user.id}
      meName={getUserDisplayName(user.first_name, user.last_name) || user.email || ""}
    >
      {children}
      <MessagesBar />
      <ChatWindowsDock />
    </ChatProvider>
  );
}

/** Up to three windows at the bottom, next to the bar (newest on the right) */
function ChatWindowsDock() {
  const windows = useChatWindowsStore((s) => s.windows);
  const expanded = useChatWindowsStore((s) => s.expanded);
  const openWindow = useChatWindowsStore((s) => s.openWindow);
  const { subscribe, meId, isVisible } = useChat();
  const pathname = usePathname();
  // The Messages page shows conversations itself
  const onMessagesPage = pathname.startsWith("/dashboard/messages");

  // A new message from someone else opens its window (collapsed if not already open)
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== "message" || event.message.kind !== "text") return;
        if (event.message.author_id === meId || isVisible(event.conversation_id)) return;
        const state = useChatWindowsStore.getState();
        if (state.windows.some((w) => w.conversationId === event.conversation_id)) return;
        openWindow(event.conversation_id, { collapsed: true });
      }),
    [isVisible, meId, openWindow, subscribe]
  );

  if (onMessagesPage || windows.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed z-40 hidden items-end gap-2 lg:flex"
      style={{
        bottom: STATUS_BAR_HEIGHT,
        right: (expanded ? MESSAGES_BAR_EXPANDED_WIDTH : MESSAGES_BAR_COLLAPSED_WIDTH) + 12,
      }}
      data-testid="chat-windows"
    >
      {windows.map((state) => (
        <ChatWindow key={state.conversationId} state={state} />
      ))}
    </div>
  );
}
