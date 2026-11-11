"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "../lib/utils";
import { requestVisitPanelClose } from "../visit-table/visit-panel-motion";

// A row of a portal table that opens it in the side panel when
// clicked anywhere (the link in its first cell is the same, for
// the keyboard). Clicks on the row's own links and menus stay theirs.

export function TableRow({
  href,
  selected,
  children,
}: {
  /** The table's address with this visit open (or closed, if it is). */
  href: string;
  selected: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, [role='menu'], [role='menuitem']")) {
      return;
    }
    if (window.getSelection()?.toString()) return;
    // Its own row closes the panel (sliding it out).
    if (selected && requestVisitPanelClose(href)) return;
    router.push(href as Route, { scroll: false });
  };
  return (
    <tr
      className={cn(
        "group cursor-pointer",
        selected ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-subtle)]"
      )}
      data-selected={selected ? "" : undefined}
      onClick={open}
    >
      {children}
    </tr>
  );
}
