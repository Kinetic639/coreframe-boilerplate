"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { respondToChatInvitationAction } from "@/app/actions/messages";
import { messagesKeys, useChatInvitations } from "@/hooks/queries/messages";
import { memberName } from "@/lib/messages/display";
import type { ChatErrorCode, ChatInvitation } from "@/lib/messages/types";
import { ChatAvatar } from "./chat-avatar";
import { useChat } from "./chat-provider";

function initialsOf(name: string | null) {
  const words = (name ?? "?").trim().split(/\s+/);
  return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

/**
 * Group invitations waiting for the user's answer. Nobody is put into a group
 * by someone else: "Join" makes the user a member (and opens the group),
 * "Decline" leaves them out. Renders nothing when there are none.
 */
export function ChatInvitations({ onJoined }: { onJoined: (conversationId: string) => void }) {
  const t = useTranslations("chat");
  const { orgId } = useChat();
  const queryClient = useQueryClient();
  const invitations = useChatInvitations(orgId).data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  const respond = async (invitation: ChatInvitation, accept: boolean) => {
    setBusyId(invitation.conversation_id);
    const result = await respondToChatInvitationAction({
      conversationId: invitation.conversation_id,
      accept,
    });
    setBusyId(null);
    // Answered elsewhere or withdrawn: the reload below removes the row
    if (!result.success && (result as { error: ChatErrorCode }).error !== "forbidden") {
      toast.error(t("errors.failed"));
    }
    queryClient.setQueryData<ChatInvitation[]>(messagesKeys.invitations(orgId), (list) =>
      list?.filter((item) => item.conversation_id !== invitation.conversation_id)
    );
    void queryClient.invalidateQueries({ queryKey: messagesKeys.invitations(orgId) });
    if (result.success && accept) {
      await queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
      onJoined(invitation.conversation_id);
    }
  };

  return (
    <section aria-label={t("invitations.title")} data-testid="chat-invitations">
      <div className="px-1.5 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("invitations.title")}
      </div>
      <ul className="flex flex-col gap-1">
        {invitations.map((invitation) => {
          const busy = busyId === invitation.conversation_id;
          return (
            <li
              key={invitation.conversation_id}
              className="rounded-md border border-primary/30 bg-primary/[0.07] p-1.5"
            >
              <div className="flex items-center gap-2">
                <ChatAvatar initials={initialsOf(invitation.name)} group size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{invitation.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {invitation.invited_by
                      ? t("invitations.from", { name: memberName(invitation.invited_by) })
                      : t("invitations.fromUnknown")}
                    {" · "}
                    {t("window.members", { count: invitation.member_count })}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond(invitation, true)}
                  className="flex h-6 flex-1 items-center justify-center gap-1 rounded bg-primary px-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3 animate-spin" /> : null}
                  {t("invitations.join")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond(invitation, false)}
                  className="h-6 flex-1 rounded border bg-background px-2 text-[11px] text-foreground/80 hover:bg-muted disabled:opacity-50"
                >
                  {t("invitations.decline")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
