"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Reply, Edit2, Trash2, Copy, Check, CheckCheck, Clock } from "lucide-react";
import { Message } from "@/lib/stores/chat-store";
import { useUserStore } from "@/lib/stores/user-store";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { getUserInitials, getUserDisplayName } from "@/utils/user-helpers";

interface ChatMessageProps {
  message: Message;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  className?: string;
}

export default function ChatMessage({
  message,
  onReply,
  onEdit,
  onDelete,
  className,
}: ChatMessageProps) {
  const t = useTranslations();
  const { user } = useUserStore();
  const [showFullTime, setShowFullTime] = useState(false);

  const isOwnMessage = message.sender_id === user?.id;
  const senderName = getUserDisplayName(message.sender.first_name, message.sender.last_name);
  const senderInitials = getUserInitials(
    message.sender.first_name,
    message.sender.last_name,
    message.sender.email
  );

  const getMessageStatus = () => {
    if (!isOwnMessage || !message.status?.length) return null;

    const currentUserStatus = message.status.find((s) => s.user_id === user?.id);
    if (!currentUserStatus) return null;

    switch (currentUserStatus.status) {
      case "sent":
        return { icon: Check, label: t("teams.communication.sent"), variant: "secondary" as const };
      case "delivered":
        return {
          icon: CheckCheck,
          label: t("teams.communication.delivered"),
          variant: "secondary" as const,
        };
      case "read":
        return {
          icon: CheckCheck,
          label: t("teams.communication.read"),
          variant: "default" as const,
        };
      default:
        return {
          icon: Clock,
          label: t("teams.communication.sending"),
          variant: "outline" as const,
        };
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);

    if (showFullTime) {
      return format(date, "PPp"); // Full date and time
    }

    try {
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return format(date, "HH:mm"); // Just time for today
      } else if (diffInHours < 48) {
        return t("teams.communication.yesterday");
      } else {
        return format(date, "MMM d"); // Month and day
      }
    } catch {
      return "";
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      // TODO: Show success toast
    } catch (error) {
      console.error("Failed to copy message:", error);
      // TODO: Show error toast
    }
  };

  const messageStatus = getMessageStatus();

  return (
    <div className={`group flex gap-3 p-3 transition-colors hover:bg-muted/30 ${className || ""}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.sender.avatar_url} alt={senderName} />
          <AvatarFallback className="bg-primary/10 text-xs text-primary">
            {senderInitials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Message Content */}
      <div className="min-w-0 flex-1">
        {/* Message Header */}
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-medium">{senderName}</span>

          <button
            onClick={() => setShowFullTime(!showFullTime)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {formatMessageTime(message.created_at)}
          </button>

          {message.edited_at && (
            <Badge variant="outline" className="h-4 text-xs">
              {t("teams.communication.edited")}
            </Badge>
          )}

          {messageStatus && (
            <div className="flex items-center gap-1">
              <messageStatus.icon className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="text-sm leading-relaxed">
          {message.deleted_at ? (
            <span className="italic text-muted-foreground">
              {t("teams.communication.messageDeleted")}
            </span>
          ) : (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          )}
        </div>
      </div>

      {/* Message Actions */}
      <div className="flex items-start opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-40">
            {onReply && !message.deleted_at && (
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply className="mr-2 h-4 w-4" />
                {t("teams.communication.reply")}
              </DropdownMenuItem>
            )}

            {!message.deleted_at && (
              <DropdownMenuItem onClick={handleCopyMessage}>
                <Copy className="mr-2 h-4 w-4" />
                {t("teams.communication.copy")}
              </DropdownMenuItem>
            )}

            {isOwnMessage && onEdit && !message.deleted_at && (
              <DropdownMenuItem onClick={() => onEdit(message)}>
                <Edit2 className="mr-2 h-4 w-4" />
                {t("teams.communication.edit")}
              </DropdownMenuItem>
            )}

            {isOwnMessage && onDelete && !message.deleted_at && (
              <DropdownMenuItem
                onClick={() => onDelete(message.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("teams.communication.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
