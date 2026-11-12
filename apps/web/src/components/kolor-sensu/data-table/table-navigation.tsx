"use client";

import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { PageLink, type PageLinkProps } from "../public-site/page-link";

// How a table's own links (sorting, pages, rows) move. Without a provider
// they are ordinary links: the server renders the page for the new address.
// A list that fetches its rows itself (a client cache keyed by the address)
// provides `navigate`, and a plain click only changes the address
// (history.pushState, which Next keeps in step with useSearchParams), so the
// list answers from its cache or fetches just its rows, never the page.
//
// None of these links prefetch: a table holds hundreds of them, and a
// prefetch per link is a request per link.

export type TableNavigate = (href: string) => void;

const TableNavigationContext = createContext<TableNavigate | null>(null);

export function TableNavigationProvider({
  navigate,
  children,
}: {
  navigate: TableNavigate;
  children: ReactNode;
}) {
  return (
    <TableNavigationContext.Provider value={navigate}>{children}</TableNavigationContext.Provider>
  );
}

export function useTableNavigate() {
  return useContext(TableNavigationContext);
}

/** A left click with no key held: the one a page may take over. */
export function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** The address is this page's own (only its query differs). */
export function isSamePage(href: string) {
  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin && url.pathname === window.location.pathname;
}

/**
 * A table's link: no prefetch, and in-place with a TableNavigationProvider
 * when it leads to this same page (another page is an ordinary navigation).
 */
export function TableLink({ href, onClick, ...props }: PageLinkProps) {
  const navigate = useTableNavigate();
  return (
    <PageLink
      scroll={false}
      {...props}
      href={href}
      prefetch={false}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !navigate || !isPlainClick(event) || !isSamePage(href)) {
          return;
        }
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}
