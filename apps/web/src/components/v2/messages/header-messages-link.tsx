"use client";

import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useConversations } from "@/hooks/queries/messages";
import { unreadConversations } from "@/lib/messages/cache";
import { ChatCountBadge } from "./chat-avatar";
import { useOptionalChat } from "./chat-provider";

/**
 * Messages icon in the app header for screens without the right bar (below
 * `lg`): opens the Messages page, with the count of unread conversations.
 * On wider screens the icon lives at the top of the bar instead.
 */
export function HeaderMessagesLink() {
  const chat = useOptionalChat();
  if (!chat) return null;
  return <HeaderMessagesLinkInner orgId={chat.orgId} />;
}

function HeaderMessagesLinkInner({ orgId }: { orgId: string }) {
  const t = useTranslations("chat");
  const unread = unreadConversations(useConversations(orgId).data);

  return (
    <Link
      href="/dashboard/messages"
      aria-label={t("bar.label")}
      title={t("bar.label")}
      data-testid="header-messages-link"
      className="relative flex size-9 items-center justify-center rounded-md text-foreground/80 hover:bg-accent lg:hidden"
    >
      <MessageSquare className="size-[18px]" />
      {unread > 0 ? <ChatCountBadge count={unread} className="absolute right-0.5 top-0.5" /> : null}
    </Link>
  );
}
