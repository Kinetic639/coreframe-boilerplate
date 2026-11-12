"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "../lib/utils";
import { requestVisitPanelClose } from "../visit-table/visit-panel-motion";
import { isSamePage, useTableNavigate } from "./table-navigation";

// A row of a portal table that opens it in the side panel when
// clicked anywhere (the link in its first cell is the same, for
// the keyboard). Clicks on the row's own links and menus stay theirs.

export function TableRow({
  href,
  selected,
  rowId,
  onIntent,
  children,
}: {
  /** The row's key, as data-row-id (to find it, e.g. to scroll it into view). */
  rowId?: string;
  /** The pointer rests on the row or it has focus (false: it left). */
  onIntent?: (active: boolean) => void;
  /** The table's address with this visit open (or closed, if it is). */
  href: string;
  selected: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const navigate = useTableNavigate();
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, [role='menu'], [role='menuitem']")) {
      return;
    }
    if (window.getSelection()?.toString()) return;
    // Its own row closes the panel (sliding it out).
    if (selected && requestVisitPanelClose(href)) return;
    if (navigate && isSamePage(href)) navigate(href);
    else router.push(href as Route, { scroll: false });
  };
  return (
    <tr
      className={cn(
        "group cursor-pointer",
        selected ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-subtle)]"
      )}
      data-selected={selected ? "" : undefined}
      data-row-id={rowId}
      onClick={open}
      onMouseEnter={onIntent ? () => onIntent(true) : undefined}
      onMouseLeave={onIntent ? () => onIntent(false) : undefined}
      onFocus={onIntent ? () => onIntent(true) : undefined}
    >
      {children}
    </tr>
  );
}
