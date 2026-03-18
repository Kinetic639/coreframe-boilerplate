"use client";

import React, { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, Hash, Phone, Video, Info, Users, MoreHorizontal, Loader2 } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatEditor from "./ChatEditor";
import { useMessages, useChatList, useChatRealtime, Message } from "@/lib/stores/chat-store";
import { useUserStore } from "@/lib/stores/user-store";
import { useTranslations } from "next-intl";
import { getUserDisplayName, getUserInitials } from "@/utils/user-helpers";

interface ChatInterfaceProps {
  chatId: string;
  className?: string;
}

export default function ChatInterface({ chatId, className }: ChatInterfaceProps) {
  const t = useTranslations();
  const { user } = useUserStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const { chats, selectChat } = useChatList();
  const {
    messagesByChat,
    isLoadingMessages,
    messagesError,
    loadMessages,
    sendMessage,
    markMessageAsRead,
    editMessage,
    deleteMessage,
  } = useMessages();

  const { subscribeToChat, unsubscribeFromChat } = useChatRealtime();

  const currentChat = chats.find((c) => c.id === chatId);
  const messages = messagesByChat[chatId] || [];

  // Load messages when chat changes
  useEffect(() => {
    if (chatId) {
      selectChat(chatId);
      loadMessages(chatId);
      subscribeToChat(chatId);

      return () => {
        unsubscribeFromChat(chatId);
      };
    }
  }, [chatId, selectChat, loadMessages, subscribeToChat, unsubscribeFromChat]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Mark messages as read when they become visible
  useEffect(() => {
    if (messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg) =>
          msg.sender_id !== user.id &&
          !msg.status?.some((s) => s.user_id === user.id && s.status === "read")
      );

      unreadMessages.forEach((msg) => {
        markMessageAsRead(msg.id);
      });
    }
  }, [messages, user, markMessageAsRead]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
    setShowScrollToBottom(false);
  };

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    setShowScrollToBottom(!isNearBottom);
  };

  const handleSendMessage = async (content: string, lexicalState?: unknown) => {
    try {
      await sendMessage(chatId, content, lexicalState, replyToMessage?.id);
      setReplyToMessage(null);
    } catch (error) {
      console.error("Failed to send message:", error);
      // TODO: Show error toast
    }
  };

  const handleEditMessage = async (content: string, lexicalState?: unknown) => {
    if (!editingMessage) return;

    try {
      await editMessage(editingMessage.id, content, lexicalState);
      setEditingMessage(null);
    } catch (error) {
      console.error("Failed to edit message:", error);
      // TODO: Show error toast
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error("Failed to delete message:", error);
      // TODO: Show error toast
    }
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    setEditingMessage(null);
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setReplyToMessage(null);
  };

  const handleCancelEditor = () => {
    setReplyToMessage(null);
    setEditingMessage(null);
  };

  const getOtherParticipant = () => {
    if (!currentChat || currentChat.type !== "direct" || !user) return null;
    return currentChat.participants.find((p) => p.id !== user.id);
  };

  const getChatDisplayName = () => {
    if (!currentChat) return t("teams.communication.chat");

    if (currentChat.name) return currentChat.name;

    const otherParticipant = getOtherParticipant();
    if (otherParticipant) {
      return getUserDisplayName(otherParticipant.first_name, otherParticipant.last_name);
    }

    return t("teams.communication.unknownChat");
  };

  const getChatDisplayAvatar = () => {
    const otherParticipant = getOtherParticipant();
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

  const displayName = getChatDisplayName();
  const avatar = getChatDisplayAvatar();

  if (!currentChat) {
    return (
      <div className={`flex h-full flex-col ${className || ""}`}>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Hash className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-medium">{t("teams.communication.chatNotFound")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("teams.communication.chatNotFoundDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-background ${className || ""}`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatar.src} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-sm text-primary">
              {avatar.fallback}
            </AvatarFallback>
          </Avatar>

          <div>
            <h3 className="font-medium">{displayName}</h3>
            {currentChat.type === "direct" && (
              <p className="text-xs text-muted-foreground">{getOtherParticipant()?.email}</p>
            )}
          </div>

          {currentChat.type === "group" && (
            <Badge variant="secondary" className="ml-2">
              <Users className="mr-1 h-3 w-3" />
              {currentChat.participants.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Info className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="relative flex-1">
        <ScrollArea className="h-full" ref={scrollAreaRef} onScrollCapture={handleScroll}>
          <div className="p-4">
            {isLoadingMessages && messages.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("teams.communication.loadingMessages")}
                </div>
              </div>
            )}

            {messagesError && (
              <div className="p-4 text-center">
                <p className="mb-2 text-sm text-destructive">{messagesError}</p>
                <Button variant="outline" size="sm" onClick={() => loadMessages(chatId)}>
                  {t("common.retry")}
                </Button>
              </div>
            )}

            {!isLoadingMessages && !messagesError && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Hash className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-sm font-medium">{t("teams.communication.noMessages")}</h3>
                <p className="max-w-[300px] text-xs text-muted-foreground">
                  {t("teams.communication.startConversation")}
                </p>
              </div>
            )}

            {messages.length > 0 && (
              <div className="space-y-2">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDeleteMessage}
                  />
                ))}

                {/* Loading indicator for new messages */}
                {isLoadingMessages && messages.length > 0 && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-4 right-4 h-10 w-10 rounded-full p-0 shadow-lg"
            onClick={() => scrollToBottom(true)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator />

      {/* Message Editor */}
      <div className="p-4">
        <ChatEditor
          onSend={editingMessage ? handleEditMessage : handleSendMessage}
          onCancel={handleCancelEditor}
          replyToMessage={replyToMessage}
          editingMessage={editingMessage}
          placeholder={
            currentChat.type === "direct"
              ? t("teams.communication.messageUser", { name: displayName })
              : t("teams.communication.messageChannel", { name: displayName })
          }
        />
      </div>
    </div>
  );
}
