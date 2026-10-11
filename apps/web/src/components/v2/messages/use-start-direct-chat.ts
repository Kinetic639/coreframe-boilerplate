"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { openDirectConversationAction } from "@/app/actions/messages";
import { messagesKeys } from "@/hooks/queries/messages";
import type { ChatErrorCode } from "@/lib/messages/types";
import { useChatWindowsStore } from "@/lib/stores/v2/chat-windows-store";
import { useOptionalChat } from "./chat-provider";

/**
 * "Message this person" from anywhere (contacts, profiles): opens (or reuses)
 * the 1:1 conversation — in a chat window on wide screens, on the Messages
 * page where the windows are hidden. Null when messages are not available to
 * the user.
 */
export function useStartDirectChat(): ((userId: string) => Promise<void>) | null {
  const chat = useOptionalChat();
  const t = useTranslations("chat");
  const router = useRouter();
  const queryClient = useQueryClient();
  const openWindow = useChatWindowsStore((s) => s.openWindow);
  const orgId = chat?.orgId;
  const meId = chat?.meId;

  const start = useCallback(
    async (userId: string) => {
      if (!orgId || userId === meId) return;
      const result = await openDirectConversationAction({ userId });
      if (!result.success) {
        toast.error(t(`errors.${(result as { error: ChatErrorCode }).error}`));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
      // Same breakpoint as the bar and the windows (Tailwind `lg`)
      if (window.matchMedia("(min-width: 1024px)").matches) openWindow(result.data);
      else router.push({ pathname: "/dashboard/messages", query: { c: result.data } });
    },
    [meId, openWindow, orgId, queryClient, router, t]
  );

  return chat ? start : null;
}
