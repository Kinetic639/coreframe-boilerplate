"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, ExternalLink, LogOut, MoreHorizontal, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "@/i18n/navigation";
import { leaveConversationAction, muteConversationAction } from "@/app/actions/messages";
import { messagesKeys } from "@/hooks/queries/messages";
import type { ChatErrorCode } from "@/lib/messages/types";
import { useChat } from "./chat-provider";

/** Muting has no end date in the UI; far enough to mean "until unmuted" */
export const CHAT_MUTED_UNTIL = "2100-01-01T00:00:00.000Z";

/**
 * "Conversation options" menu of a chat window: open in full view, mute /
 * unmute, members and settings (groups, on the Messages page), leave the
 * group (confirmed), close the window.
 */
export function ChatWindowOptions({
  conversationId,
  isGroup,
  groupName,
  muted,
  onClose,
}: {
  conversationId: string;
  isGroup: boolean;
  groupName: string;
  muted: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("chat");
  const { orgId } = useChat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const openFull = () =>
    router.push({ pathname: "/dashboard/messages", query: { c: conversationId } });

  const fail = (result: unknown) =>
    toast.error(t(`errors.${(result as { error: ChatErrorCode }).error}`));

  const toggleMute = async () => {
    const result = await muteConversationAction({
      conversationId,
      until: muted ? null : CHAT_MUTED_UNTIL,
    });
    if (!result.success) return fail(result);
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
  };

  const leave = async () => {
    const result = await leaveConversationAction({ conversationId });
    if (!result.success) return fail(result);
    onClose();
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
  };

  const itemClass = "gap-2 px-2 py-1.5 text-xs";
  const iconClass = "size-3.5";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("window.options")}
            title={t("window.options")}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52">
          <DropdownMenuItem className={itemClass} onSelect={openFull}>
            <ExternalLink className={iconClass} />
            {t("window.openFull")}
          </DropdownMenuItem>
          {isGroup ? (
            <DropdownMenuItem className={itemClass} onSelect={openFull}>
              <Users className={iconClass} />
              {t("window.manageGroup")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className={itemClass} onSelect={() => void toggleMute()}>
            {muted ? <Bell className={iconClass} /> : <BellOff className={iconClass} />}
            {muted ? t("page.unmute") : t("page.mute")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isGroup ? (
            <DropdownMenuItem
              className={`${itemClass} text-destructive focus:text-destructive`}
              onSelect={() => setConfirmLeave(true)}
            >
              <LogOut className={iconClass} />
              {t("page.leave")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className={itemClass} onSelect={onClose}>
            <X className={iconClass} />
            {t("window.close")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("page.leave")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("page.confirmLeave", { name: groupName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("page.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void leave()}>{t("page.leave")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
