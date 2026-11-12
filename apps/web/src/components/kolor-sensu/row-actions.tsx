"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "./lib/utils";
import { TableLink } from "./data-table/table-navigation";

// A table row's "⋮" menu: its actions in one place, reachable from the
// keyboard. Items are links (tel:, mailto:, pages) or buttons opening a
// dialog; the page decides which.

export function RowActions({
  label,
  children,
}: {
  /** What the row is, for the button's name: `Akcje: KS-20261001-2308`. */
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Akcje: ${label}`}
        className="inline-flex size-7 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none data-[state=open]:bg-[var(--surface-muted)] data-[state=open]:text-[var(--text)]"
      >
        <MoreVertical aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A menu item that is a link (a page, `tel:`, `mailto:`). */
export function RowActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    // The app's own pages move without a reload (and without prefetch).
    <DropdownMenuItem asChild>
      {href.startsWith("/") ? (
        <TableLink href={href} scroll>
          {icon}
          {children}
        </TableLink>
      ) : (
        <a href={href}>
          {icon}
          {children}
        </a>
      )}
    </DropdownMenuItem>
  );
}

/** A menu item that does something (e.g. opens a confirmation). */
export function RowActionButton({
  onSelect,
  icon,
  destructive = false,
  children,
}: {
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenuItem
      className={cn(
        destructive &&
          "text-[var(--danger)] focus:bg-[var(--danger-soft)] focus:text-[var(--danger)]"
      )}
      onSelect={onSelect}
    >
      {icon}
      {children}
    </DropdownMenuItem>
  );
}

export const RowActionSeparator = DropdownMenuSeparator;
