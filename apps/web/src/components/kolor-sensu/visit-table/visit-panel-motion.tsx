"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { PageLink as Link } from "../public-site/page-link";

gsap.registerPlugin(useGSAP);

// How the visit panel comes and goes. It slides in from the right when a
// visit is opened (beside the table on a wide screen, where it also makes
// room; over it on a narrow one) and slides out before the address drops
// it: its close link, Escape, or a click on its row ask it to. Another
// visit opened in it only fades its content in. No motion where it is
// reduced, and none on a page that loads with the panel already open.

const CLOSE_EVENT = "ks:visit-panel-close";
const WIDE = "(min-width: 1280px)";
const MOTION = "(prefers-reduced-motion: no-preference)";

/**
 * Asks the open panel to close to `href`: true when it does (slides out,
 * then goes there), false when there is none to ask (go there yourself).
 */
export function requestVisitPanelClose(href: string) {
  return !window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: href, cancelable: true }));
}

const noSubscribe = () => () => {};

/** Whether motion is wanted (false where it can't be told). */
function motionAllowed() {
  return typeof window.matchMedia === "function" && window.matchMedia(MOTION).matches;
}

export function VisitPanelMotion({
  visitId,
  closeHref,
  labelledBy,
  className,
  children,
}: {
  /** The visit shown: another one fades its content in. */
  visitId: string;
  /** The table's address without the panel. */
  closeHref: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  // False while hydrating a page loaded with the panel open: no entrance.
  const mountedOnClient = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );
  const enter = useRef(mountedOnClient);
  const shownVisit = useRef(visitId);

  const { contextSafe } = useGSAP(
    () => {
      if (!enter.current || !motionAllowed()) return;
      const media = gsap.matchMedia();
      media.add(`${WIDE} and ${MOTION}`, () => {
        gsap.from(root.current, {
          width: 0,
          duration: 0.3,
          ease: "power2.out",
          clearProps: "width",
        });
        gsap.from(inner.current, {
          x: 24,
          opacity: 0,
          duration: 0.3,
          delay: 0.05,
          ease: "power2.out",
          clearProps: "transform,opacity",
        });
      });
      media.add(`not ${WIDE} and ${MOTION}`, () => {
        gsap.from(root.current, {
          xPercent: 100,
          duration: 0.3,
          ease: "power2.out",
          clearProps: "transform",
        });
      });
    },
    { scope: root }
  );

  // Another visit in the open panel: its content fades in.
  useGSAP(
    () => {
      if (shownVisit.current === visitId) return;
      shownVisit.current = visitId;
      if (!motionAllowed()) return;
      gsap.fromTo(
        inner.current,
        { opacity: 0.35 },
        {
          opacity: 1,
          duration: 0.2,
          ease: "power1.out",
          clearProps: "opacity",
        }
      );
    },
    { dependencies: [visitId], scope: root }
  );

  const close = contextSafe((href: string) => {
    if (closing.current) return;
    closing.current = true;
    const go = () => router.push(href as Route, { scroll: false });
    if (!motionAllowed()) return go();
    const wide = window.matchMedia(WIDE).matches;
    gsap
      .timeline({ onComplete: go })
      .to(inner.current, {
        x: 24,
        opacity: 0,
        duration: 0.18,
        ease: "power2.in",
      })
      .to(
        root.current,
        wide
          ? { width: 0, duration: 0.24, ease: "power2.inOut" }
          : { xPercent: 100, duration: 0.24, ease: "power2.in" },
        wide ? "<0.04" : "<"
      );
  });

  // The close link, Escape and the row ask through one event.
  useEffect(() => {
    const onClose = (event: Event) => {
      event.preventDefault();
      close((event as CustomEvent<string>).detail);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Not while a dialog or a menu is open: Escape closes that first.
      if (document.querySelector("[role='dialog'], [role='alertdialog'], [role='menu']")) {
        return;
      }
      close(closeHref);
    };
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, closeHref]);

  // A new address (another visit, or back to this one): open again.
  useEffect(() => {
    closing.current = false;
  }, [visitId, closeHref]);

  return (
    <aside aria-labelledby={labelledBy} className={className} ref={root}>
      <div className="flex h-full min-h-0 w-full flex-col" ref={inner}>
        {children}
      </div>
    </aside>
  );
}

/** The panel's close link: slides the panel out first (a plain link without JS). */
export function VisitPanelCloseLink({
  href,
  className,
  children,
  ...props
}: {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      {...props}
      className={className}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        if (requestVisitPanelClose(href)) event.preventDefault();
      }}
      scroll={false}
    >
      {children}
    </Link>
  );
}
