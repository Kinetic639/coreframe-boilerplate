"use client";

import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The portal's top bar. On a phone an opened request has its own bar (close / full page),
 * so this one steps aside there.
 */
export function AppHeader({ children }: { children: React.ReactNode }) {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const ownBar = !!ticketId;
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:px-6",
        ownBar && "max-lg:hidden"
      )}
    >
      {children}
    </header>
  );
}
