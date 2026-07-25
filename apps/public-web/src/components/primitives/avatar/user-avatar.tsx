"use client";

import * as React from "react";
import { User } from "lucide-react";
import type { PopoverContentProps } from "@radix-ui/react-popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils";

function getInitials(value?: string | null): string {
  if (!value) return "";
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface UserAvatarProps extends React.ComponentPropsWithoutRef<typeof Avatar> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  profileHref?: string | null;
  profileLabel?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  popoverSide?: PopoverContentProps["side"];
  popoverAlign?: PopoverContentProps["align"];
  popoverClassName?: string;
  disabledPopover?: boolean;
}

export const UserAvatar = React.forwardRef<React.ElementRef<typeof Avatar>, UserAvatarProps>(
  (
    {
      src,
      alt,
      fallback,
      firstName,
      lastName,
      fullName,
      email,
      profileHref,
      profileLabel = "Open profile",
      imageClassName,
      fallbackClassName,
      popoverSide = "top",
      popoverAlign = "center",
      popoverClassName,
      disabledPopover = false,
      className,
      children,
      onMouseEnter,
      onMouseLeave,
      ...avatarProps
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const closeTimer = React.useRef<number | null>(null);

    React.useEffect(() => {
      return () => {
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
      };
    }, []);

    const suppliedName = fullName || [firstName, lastName].filter(Boolean).join(" ");
    const displayName = suppliedName || fallback || alt || "User";
    const initials = getInitials(fallback || displayName);
    const hasDetails = Boolean(suppliedName || email || profileHref) && !disabledPopover;

    const clearCloseTimer = () => {
      if (!closeTimer.current) return;
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    };

    const openPopover = () => {
      if (!hasDetails) return;
      clearCloseTimer();
      setOpen(true);
    };

    const closePopover = () => {
      clearCloseTimer();
      closeTimer.current = window.setTimeout(() => setOpen(false), 120);
    };

    const avatar = (
      <Avatar
        ref={ref}
        className={className}
        {...avatarProps}
        {...(hasDetails
          ? {
              onMouseEnter: (event) => {
                onMouseEnter?.(event);
                openPopover();
              },
              onMouseLeave: (event) => {
                onMouseLeave?.(event);
                closePopover();
              },
            }
          : {
              onMouseEnter,
              onMouseLeave,
            })}
      >
        {children ?? (
          <>
            {src && <AvatarImage src={src} alt={alt ?? displayName} className={imageClassName} />}
            <AvatarFallback className={cn("text-xs font-medium", fallbackClassName)}>
              {initials || <User className="h-1/2 w-1/2" />}
            </AvatarFallback>
          </>
        )}
      </Avatar>
    );

    if (!hasDetails) return avatar;

    const content = (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className={cn("h-10 w-10", className)}>
          {src && <AvatarImage src={src} alt={alt ?? displayName} className={imageClassName} />}
          <AvatarFallback className={cn("text-xs font-medium", fallbackClassName)}>
            {initials || <User className="h-1/2 w-1/2" />}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{displayName}</p>
          {email && <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>}
        </div>
      </div>
    );

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{avatar}</PopoverTrigger>

        <PopoverContent
          side={popoverSide}
          align={popoverAlign}
          className={cn("w-72 p-0", popoverClassName)}
          onMouseEnter={openPopover}
          onMouseLeave={closePopover}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {profileHref ? (
            <a
              href={profileHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={profileLabel}
              className="block rounded-md p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {content}
            </a>
          ) : (
            <div className="p-3">{content}</div>
          )}
        </PopoverContent>
      </Popover>
    );
  }
);
UserAvatar.displayName = "UserAvatar";
