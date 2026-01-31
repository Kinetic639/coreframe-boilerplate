"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MessageSquare, CheckCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Avatar } from "@/components/v2/utility/avatar";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";

/**
 * Header Messages Component
 *
 * Messages drawer that slides from the right
 *
 * Features:
 * - Message icon with unread count badge
 * - Slide-out drawer from right side
 * - Example messages with avatars
 * - Mark individual messages as read
 * - Remove messages
 *
 * TODO: Connect to real messaging system:
 * - Real-time updates via Supabase Realtime
 * - Persist read status to database
 * - Link to full messages page
 * - Send/reply functionality
 */

interface Message {
  id: string;
  sender: {
    name: string;
    avatar?: string;
    initials: string;
  };
  subject: string;
  preview: string;
  timestamp: string;
  isRead: boolean;
}

const EXAMPLE_MESSAGES: Message[] = [
  {
    id: "1",
    sender: {
      name: "Sarah Johnson",
      initials: "SJ",
    },
    subject: "Q1 Inventory Report",
    preview: "Hi! I've finished the Q1 inventory report. Can you review it when you have a moment?",
    timestamp: "2 min ago",
    isRead: false,
  },
  {
    id: "2",
    sender: {
      name: "Mike Chen",
      initials: "MC",
    },
    subject: "Warehouse Audit Tomorrow",
    preview: "Just a reminder that we have the warehouse audit scheduled for tomorrow at 9 AM.",
    timestamp: "1 hour ago",
    isRead: false,
  },
  {
    id: "3",
    sender: {
      name: "Emma Davis",
      initials: "ED",
    },
    subject: "Product Stock Update",
    preview: "The new shipment arrived. I've updated the stock levels in the system.",
    timestamp: "3 hours ago",
    isRead: false,
  },
  {
    id: "4",
    sender: {
      name: "Alex Martinez",
      initials: "AM",
    },
    subject: "Team Meeting Notes",
    preview: "Attached are the notes from today's team meeting. Let me know if I missed anything.",
    timestamp: "Yesterday",
    isRead: true,
  },
  {
    id: "5",
    sender: {
      name: "Lisa Wong",
      initials: "LW",
    },
    subject: "Purchase Order Approved",
    preview: "Your purchase order #12345 has been approved and will be processed shortly.",
    timestamp: "2 days ago",
    isRead: true,
  },
];

export function HeaderMessages() {
  const [messages, setMessages] = useState(EXAMPLE_MESSAGES);
  const isLoading = false;
  const unreadCount = messages.filter((m) => !m.isRead).length;

  const markAsRead = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
  };

  const markAllAsRead = () => {
    setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
          aria-label={`Messages ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        >
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Messages</SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `You have ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`
              : "You're all caught up!"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          {isLoading ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            <div className="no-scrollbar overflow-y-auto max-h-[calc(100vh-200px)] space-y-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "group relative flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer",
                    !message.isRead && "bg-muted/30"
                  )}
                  onClick={() => !message.isRead && markAsRead(message.id)}
                >
                  <div className="shrink-0">
                    <Avatar
                      src={message.sender.avatar}
                      alt={message.sender.name}
                      fallback={message.sender.initials}
                      size="md"
                      shape="circle"
                    />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-none truncate">
                          {message.sender.name}
                        </p>
                        {!message.isRead && (
                          <span className="inline-block h-2 w-2 rounded-full bg-primary mt-1" />
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMessage(message.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        aria-label="Remove message"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    <p className="text-sm font-medium truncate">{message.subject}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{message.preview}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{message.timestamp}</p>
                      {!message.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(message.id);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="w-full">
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
