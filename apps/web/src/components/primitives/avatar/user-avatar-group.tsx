"use client";

import * as React from "react";
import { User } from "lucide-react";
import type { PopoverContentProps } from "@radix-ui/react-popover";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "./user-avatar";
import type { UserAvatarProps } from "./user-avatar";

export interface UserAvatarGroupItem extends Pick<
  UserAvatarProps,
  | "src"
  | "alt"
  | "fallback"
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "profileHref"
  | "profileLabel"
  | "disabledPopover"
> {
  id: string;
}

export interface UserAvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  users: UserAvatarGroupItem[];
  max?: number;
  size?: NonNullable<UserAvatarProps["size"]>;
  popoverSide?: PopoverContentProps["side"];
  popoverAlign?: PopoverContentProps["align"];
  overflowLabel?: string;
}

function displayName(user: UserAvatarGroupItem): string {
  return (
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.fallback ||
    user.alt ||
    "User"
  );
}

function initials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function OverflowAvatar({
  users,
  label,
  side,
  align,
}: {
  users: UserAvatarGroupItem[];
  label: string;
  side: PopoverContentProps["side"];
  align: PopoverContentProps["align"];
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const clearCloseTimer = () => {
    if (!closeTimer.current) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const openPopover = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const closePopover = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <AvatarGroupCount
          role="button"
          tabIndex={0}
          className="cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onMouseEnter={openPopover}
          onMouseLeave={closePopover}
          aria-label={label}
        >
          +{users.length}
        </AvatarGroupCount>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}
        className="w-80 p-2"
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="max-h-80 overflow-y-auto">
          {users.map((user) => {
            const name = displayName(user);
            const rowContent = (
              <>
                <Avatar className="h-9 w-9">
                  {user.src && <AvatarImage src={user.src} alt={user.alt ?? name} />}
                  <AvatarFallback className="text-xs font-medium">
                    {initials(user.fallback || name) || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{name}</p>
                  {user.email && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                  )}
                </div>
              </>
            );

            return user.profileHref ? (
              <a
                key={user.id}
                href={user.profileHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={user.profileLabel ?? "Open profile"}
                className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {rowContent}
              </a>
            ) : (
              <div key={user.id} className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2">
                {rowContent}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function UserAvatarGroup({
  users,
  max = 5,
  size = "default",
  popoverSide = "top",
  popoverAlign = "center",
  overflowLabel = "Show more users",
  className,
  ...props
}: UserAvatarGroupProps) {
  const visibleCount = Math.max(1, max);
  const visibleUsers = users.slice(0, visibleCount);
  const overflowUsers = users.slice(visibleCount);

  if (!users.length) return null;

  return (
    <AvatarGroup className={className} {...props}>
      {visibleUsers.map((user) => (
        <UserAvatar
          key={user.id}
          {...user}
          size={size}
          popoverSide={popoverSide}
          popoverAlign={popoverAlign}
        />
      ))}

      {overflowUsers.length > 0 && (
        <OverflowAvatar
          users={overflowUsers}
          label={overflowLabel}
          side={popoverSide}
          align={popoverAlign}
        />
      )}
    </AvatarGroup>
  );
}
