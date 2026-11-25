"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { memberInitials, memberName } from "@/lib/messages/display";
import type { ChatMemberProfile } from "@/lib/messages/types";
import { ChatAvatar } from "./chat-avatar";
import { useChat } from "./chat-provider";

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 150;

/**
 * List of people behind a short label ("3 osoby", "Przeczytane przez 2").
 * With a mouse it opens on hover like a tooltip (and stays open while the
 * pointer is over the list); on touch screens and with the keyboard the label
 * is a button that opens and closes it.
 */
export function ChatPeoplePopover({
  people,
  title,
  showStatus = false,
  emptyText,
  children,
  className,
  side = "bottom",
  align = "start",
}: {
  people: ChatMemberProfile[];
  title: string;
  /** Online / offline under each name (members); readers show names only */
  showStatus?: boolean;
  emptyText?: string;
  /** The label that opens the list */
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const t = useTranslations("chat");
  const { meId, onlineIds } = useChat();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointer = useRef<string | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (value: boolean, delay: number) => {
    clear();
    timer.current = setTimeout(() => setOpen(value), delay);
  };
  useEffect(() => clear, []);

  // Online people first, then by name; the reader ("Ty") last
  const sorted = [...people].sort((a, b) => {
    if (a.user_id === meId) return 1;
    if (b.user_id === meId) return -1;
    if (showStatus) {
      const online = Number(onlineIds.has(b.user_id)) - Number(onlineIds.has(a.user_id));
      if (online !== 0) return online;
    }
    return memberName(a).localeCompare(memberName(b));
  });

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        clear();
        setOpen(value);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-w-0 items-center gap-1 rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
          onPointerDown={(event) => {
            lastPointer.current = event.pointerType;
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") later(true, OPEN_DELAY_MS);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") later(false, CLOSE_DELAY_MS);
          }}
          onClick={(event) => {
            // The parent (window header) must not collapse when the label is pressed
            event.stopPropagation();
            // A mouse already opened it on hover: a click keeps it open instead of toggling
            if (lastPointer.current === "mouse") {
              event.preventDefault();
              clear();
              setOpen(true);
            }
          }}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        // Keep the focus in the message box (the list is read-only)
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") clear();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") later(false, CLOSE_DELAY_MS);
        }}
        className="w-60 p-0"
        data-testid="chat-people-popover"
      >
        <div className="border-b px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          {title}
        </div>
        {sorted.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto px-3 py-2">
            {sorted.map((person) => {
              const online = onlineIds.has(person.user_id);
              return (
                <li key={person.user_id} className="flex items-center gap-2">
                  <ChatAvatar
                    initials={memberInitials(person)}
                    src={person.avatar_url}
                    online={showStatus && online}
                    size={22}
                    ringClassName="ring-popover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {person.user_id === meId
                        ? `${memberName(person)} (${t("window.you")})`
                        : memberName(person)}
                    </span>
                    {showStatus ? (
                      <span
                        className={cn(
                          "block text-[10px]",
                          online
                            ? "text-emerald-700 dark:text-emerald-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {online ? t("window.online") : t("window.offline")}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
