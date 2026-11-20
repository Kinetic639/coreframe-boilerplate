"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/utils";

export interface AvatarPreviewProps {
  /** Full-size image to show; without it the avatar is not clickable. */
  src?: string | null;
  /** Person's name: the dialog title and the image's alt text. */
  name: string;
  /** Accessible label of the clickable avatar, e.g. "Show profile photo". */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps an avatar so a click opens the photo enlarged in a dialog. Uploaded
 * avatars are stored at up to 512 px, so the dialog shows them at that size at
 * most. Without an image (initials only) the avatar renders as is.
 */
export function AvatarPreview({
  src,
  name,
  label = "Show profile photo",
  className,
  children,
}: AvatarPreviewProps) {
  const [open, setOpen] = React.useState(false);

  if (!src) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
        className={cn(
          "shrink-0 cursor-zoom-in rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(calc(100vw-2rem),32rem)] max-w-none gap-3 p-3 sm:p-4">
          <DialogTitle className="truncate pr-10 text-base leading-8" title={name}>
            {name}
          </DialogTitle>
          <DialogDescription className="sr-only">{label}</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, already resized to 512 px */}
          <img
            src={src}
            alt={name}
            className="mx-auto aspect-square w-full max-w-[512px] rounded-md bg-muted object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
