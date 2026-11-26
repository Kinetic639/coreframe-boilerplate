"use client";

import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The portal's top bar. On a phone, an opened request and the new-request form have their
 * own bar (back / close), so this one steps aside there.
 */
export function AppHeader({ children }: { children: React.ReactNode }) {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const pathname = usePathname();
  const ownBar = !!ticketId || /\/(new|nowe)$/.test(pathname);
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
