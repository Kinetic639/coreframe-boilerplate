"use client";

import { type MouseEvent, type ReactNode, useState } from "react";
import { cn } from "../lib/utils";
import { PageLink as Link } from "../public-site/page-link";

// The visit panel's tabs. Every tab's content comes rendered from the
// server; a click shows another one and puts it in the address (so a
// refresh or a shared link opens it) without asking the server for
// anything. The tabs stay links: they work without JavaScript, and a
// modified click opens the tab's address elsewhere.

export function VisitPanelTabs<Key extends string>({
  tabs,
  initial,
  panes,
  label = "Sekcje rezerwacji",
}: {
  tabs: { key: Key; label: string; href: string }[];
  /** The tab in the address when the page was rendered. */
  initial: Key;
  /** Each tab's content, by its key. */
  panes: Partial<Record<Key, ReactNode>>;
  /** The tabs' name. */
  label?: string;
}) {
  const [active, setActive] = useState(initial);
  const show = (key: Key, href: string) => (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    setActive(key);
    window.history.replaceState(null, "", href);
  };
  return (
    <>
      <nav
        aria-label={label}
        className="flex h-8 shrink-0 items-stretch gap-3.5 border-b border-[var(--border)] px-3.5"
      >
        {tabs.map((one) => {
          const current = one.key === active;
          return (
            <Link
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex items-center text-[0.8125rem] outline-none focus-visible:text-[var(--text)] focus-visible:underline",
                current
                  ? "font-medium text-[var(--text)] shadow-[inset_0_-2px_0_var(--primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              )}
              href={one.href}
              key={one.key}
              onClick={show(one.key, one.href)}
              scroll={false}
            >
              {one.label}
            </Link>
          );
        })}
      </nav>

      {/* Only the tab scrolls, inside the panel (never the page under it);
          the header and the toolbar stay in view. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tabs.map((one) => (
          <div hidden={one.key !== active} key={one.key}>
            {panes[one.key]}
          </div>
        ))}
      </div>
    </>
  );
}
