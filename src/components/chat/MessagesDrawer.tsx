"use client";

import React, { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessagesSquare, Search, Plus, ChevronRight, MessageCircle } from "lucide-react";
import { useChatUI, useChatList } from "@/lib/stores/chat-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { getUserInitials, getUserDisplayName } from "@/utils/user-helpers";

interface MessagesDrawerProps {
  trigger?: React.ReactNode;
}

export default function MessagesDrawer({ trigger }: MessagesDrawerProps) {
  const t = useTranslations();
  const router = useRouter();
  const { activeOrgId, activeBranchId } = useAppStore();
  const { user } = useUserStore();

  const {
    isMessagesDrawerOpen,
    setMessagesDrawerOpen,
    searchQuery,
    setSearchQuery,
    toggleMessagesDrawer,
  } = useChatUI();

  const { chats, isLoading, error, loadChats } = useChatList();

  // Load chats when drawer opens
  useEffect(() => {
    if (isMessagesDrawerOpen && activeOrgId && activeBranchId) {
      loadChats(activeOrgId, activeBranchId);
    }
  }, [isMessagesDrawerOpen, activeOrgId, activeBranchId]); // Removed loadChats from dependencies

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    // Search in participant names
    const participantMatch = chat.participants.some((participant) => {
      const displayName = getUserDisplayName(participant.first_name, participant.last_name);
      return (
        displayName.toLowerCase().includes(query) || participant.email.toLowerCase().includes(query)
      );
    });

    // Search in last message content
    const messageMatch = chat.last_message?.content.toLowerCase().includes(query);

    return participantMatch || messageMatch;
  });

  const getOtherParticipant = (chat: any) => {
    if (chat.type === "direct" && user) {
      return chat.participants.find((p: any) => p.id !== user.id);
    }
    return null;
  };

  const getChatDisplayName = (chat: any) => {
    if (chat.name) return chat.name;

    const otherParticipant = getOtherParticipant(chat);
    if (otherParticipant) {
      return getUserDisplayName(otherParticipant.first_name, otherParticipant.last_name);
    }

    return t("teams.communication.unknownChat");
  };

  const getChatDisplayAvatar = (chat: any) => {
    const otherParticipant = getOtherParticipant(chat);
    if (otherParticipant) {
      return {
        src: otherParticipant.avatar_url,
        fallback: getUserInitials(
          otherParticipant.first_name,
          otherParticipant.last_name,
          otherParticipant.email
        ),
      };
    }

    return {
      src: undefined,
      fallback: "??",
    };
  };

  const formatLastMessageTime = (timestamp?: string) => {
    if (!timestamp) return "";

    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: pl });
    } catch {
      return "";
    }
  };

  const renderChatItem = (chat: any) => {
    const displayName = getChatDisplayName(chat);
    const avatar = getChatDisplayAvatar(chat);
    const lastMessageTime = formatLastMessageTime(chat.last_message_at);

    return (
      <div
        key={chat.id}
        className="block cursor-pointer"
        onClick={() => {
          setMessagesDrawerOpen(false);
          router.push({
            pathname: "/dashboard-old/teams/communication/chat/[chatId]",
            params: { chatId: chat.id },
          });
        }}
      >
        <div className="group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatar.src} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                {avatar.fallback}
              </AvatarFallback>
            </Avatar>
            {chat.unread_count > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
              >
                {chat.unread_count > 99 ? "99+" : chat.unread_count}
              </Badge>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="truncate text-sm font-medium">{displayName}</h4>
              {lastMessageTime && (
                <span className="text-xs text-muted-foreground">{lastMessageTime}</span>
              )}
            </div>

            {chat.last_message && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {chat.last_message.sender_id === user?.id ? `${t("common.you")}: ` : ""}
                {chat.last_message.content ||
                  (chat.last_message.content_type === "image"
                    ? `📷 ${t("common.image")}`
                    : t("common.message"))}
              </p>
            )}
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </div>
      </div>
    );
  };

  const defaultTrigger = (
    <Button variant="ghost-themed" size="sm" className="h-9 w-9 p-0">
      <MessagesSquare className="h-4 w-4" />
    </Button>
  );

  return (
    <Sheet open={isMessagesDrawerOpen} onOpenChange={setMessagesDrawerOpen}>
      <SheetTrigger asChild onClick={toggleMessagesDrawer}>
        {trigger || defaultTrigger}
      </SheetTrigger>

      <SheetContent side="right" className="w-full p-0 sm:w-96">
        <div className="flex h-full flex-col">
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {t("teams.communication.messages")}
              </SheetTitle>
              <Link href="/dashboard-old/teams/communication/chat">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMessagesDrawerOpen(false)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Search */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder={t("teams.communication.searchChats")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </SheetHeader>

          <Separator />

          <ScrollArea className="flex-1">
            <div className="p-2">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    {t("common.loading")}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      activeOrgId && activeBranchId && loadChats(activeOrgId, activeBranchId)
                    }
                    className="mt-2"
                  >
                    {t("common.retry")}
                  </Button>
                </div>
              )}

              {!isLoading && !error && filteredChats.length === 0 && (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mb-2 text-sm font-medium">
                    {searchQuery
                      ? t("teams.communication.noChatsFound")
                      : t("teams.communication.noChats")}
                  </h3>
                  <p className="mb-4 max-w-[200px] text-xs text-muted-foreground">
                    {searchQuery
                      ? t("teams.communication.tryDifferentSearch")
                      : t("teams.communication.startFirstChat")}
                  </p>
                  {!searchQuery && (
                    <Link href="/dashboard-old/teams/communication/chat">
                      <Button size="sm" onClick={() => setMessagesDrawerOpen(false)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("teams.communication.newChat")}
                      </Button>
                    </Link>
                  )}
                </div>
              )}

              {!isLoading && !error && filteredChats.length > 0 && (
                <div className="space-y-1">{filteredChats.map(renderChatItem)}</div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-4">
            <Link href="/dashboard-old/teams/communication/chat">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setMessagesDrawerOpen(false)}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {t("teams.communication.viewAllChats")}
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
