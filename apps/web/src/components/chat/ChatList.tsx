"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, Plus, MessageCircle, User, Loader2 } from "lucide-react";
import { useChatList } from "@/lib/stores/chat-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { getUserInitials, getUserDisplayName } from "@/utils/user-helpers";
import { useChatUsers } from "@/hooks/use-chat-users";

interface ChatListProps {
  onChatSelect?: (chatId: string) => void;
  selectedChatId?: string | null;
  className?: string;
}

export default function ChatList({ onChatSelect, selectedChatId, className }: ChatListProps) {
  const t = useTranslations();
  const { activeOrgId, activeBranchId } = useAppStore();
  const { user } = useUserStore();
  const { validChatUsers, isLoading: isLoadingUsers, loadUsers } = useChatUsers();

  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const { chats, isLoading, error, loadChats, createDirectChat, selectChat } = useChatList();

  // Load chats when component mounts or org/branch changes
  useEffect(() => {
    if (activeOrgId && activeBranchId) {
      loadChats(activeOrgId, activeBranchId);
    }
  }, [activeOrgId, activeBranchId, loadChats]);

  // Load users when component mounts
  useEffect(() => {
    if (activeOrgId) {
      loadUsers();
    }
  }, [activeOrgId, loadUsers]);

  // Filter available users based on search query
  const filteredUsers = validChatUsers
    .filter((chatUser) => {
      if (!userSearchQuery.trim()) return true;

      // Exclude current user
      if (chatUser.id === user?.id) return false;

      const query = userSearchQuery.toLowerCase();
      const displayName = getUserDisplayName(chatUser.first_name, chatUser.last_name);

      // Check if user matches search query
      const nameMatch = displayName.toLowerCase().includes(query);
      const emailMatch = chatUser.email.toLowerCase().includes(query);

      return nameMatch || emailMatch;
    })
    .filter((chatUser) => {
      // Filter out users we already have direct chats with
      const existingChatUserIds = new Set(
        chats
          .filter((chat) => chat.type === "direct")
          .flatMap((chat) => chat.participants.map((p) => p.id))
          .filter((id) => id !== user?.id)
      );

      return !existingChatUserIds.has(chatUser.id);
    });

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    // Search in participant names
    const participantMatch = chat.participants.some((participant) => {
      if (participant.id === user?.id) return false; // Don't match current user
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

  const handleChatSelect = (chatId: string) => {
    selectChat(chatId);
    onChatSelect?.(chatId);
  };

  const handleStartNewChat = async (otherUser: any) => {
    if (!activeOrgId || !activeBranchId) return;

    try {
      setIsNewChatDialogOpen(false);
      const newChat = await createDirectChat(otherUser.id, activeOrgId, activeBranchId);

      // Navigate to the new chat
      window.location.href = `/dashboard/teams/communication/chat/${newChat.id}`;

      // Select the chat in the list
      handleChatSelect(newChat.id);
    } catch (error) {
      console.error("Error creating chat:", error);
      // TODO: Show error toast
    }
  };

  const renderChatItem = (chat: any) => {
    const displayName = getChatDisplayName(chat);
    const avatar = getChatDisplayAvatar(chat);
    const lastMessageTime = formatLastMessageTime(chat.last_message_at);
    const isSelected = selectedChatId === chat.id;

    return (
      <div
        key={chat.id}
        className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50 ${
          isSelected ? "bg-muted/50 ring-1 ring-ring" : ""
        }`}
        onClick={() => handleChatSelect(chat.id)}
      >
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
              {chat.last_message.sender_id === user?.id ? "You: " : ""}
              {chat.last_message.content ||
                (chat.last_message.content_type === "image" ? "📷 Image" : "Message")}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-full flex-col bg-background ${className || ""}`}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("teams.communication.messages")}</h2>

          <Dialog open={isNewChatDialogOpen} onOpenChange={setIsNewChatDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 w-8 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("teams.communication.startNewChat")}</DialogTitle>
              </DialogHeader>

              <Command>
                <CommandInput
                  placeholder={t("teams.communication.searchUsers")}
                  value={userSearchQuery}
                  onValueChange={setUserSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingUsers ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("common.loading")}
                      </div>
                    ) : userSearchQuery ? (
                      t("teams.communication.noUsersFound")
                    ) : (
                      t("teams.communication.typeToSearch")
                    )}
                  </CommandEmpty>

                  {filteredUsers.length > 0 && (
                    <CommandGroup heading={t("teams.communication.availableUsers")}>
                      {filteredUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => handleStartNewChat(user)}
                          className="flex cursor-pointer items-center gap-3"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={user.avatar_url || undefined}
                              alt={getUserDisplayName(user.first_name, user.last_name)}
                            />
                            <AvatarFallback className="bg-primary/10 text-xs text-primary">
                              {getUserInitials(user.first_name, user.last_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {getUserDisplayName(user.first_name, user.last_name)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <User className="h-4 w-4 text-muted-foreground" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder={t("teams.communication.searchChats")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <p className="mb-2 text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  activeOrgId && activeBranchId && loadChats(activeOrgId, activeBranchId)
                }
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
                <Button size="sm" onClick={() => setIsNewChatDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("teams.communication.newChat")}
                </Button>
              )}
            </div>
          )}

          {!isLoading && !error && filteredChats.length > 0 && (
            <div className="space-y-1">{filteredChats.map(renderChatItem)}</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
