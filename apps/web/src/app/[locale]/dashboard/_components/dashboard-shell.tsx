"use client";

import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  Fragment,
  createContext,
  useContext,
  useRef,
} from "react";
import {
  FloatingPortal,
  safePolygon,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarInset,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { NavUser } from "@/components/nav-user";
import { SidebarBranchSwitcher } from "./sidebar-branch-switcher";
import { SidebarOrgHeader } from "./sidebar-org-header";
import type { BranchDataV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { getUserDisplayName } from "@/utils/user-helpers";
import { DashboardStatusBar } from "@/components/Dashboard/DashboardStatusBar";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";
import { MessagesRoot } from "@/components/v2/messages/messages-root";
import { SearchSourcesProvider } from "@/lib/global-search/sources-context";
import type { SearchEntry } from "@/lib/global-search/types";
import type { SearchSourceId } from "@/lib/global-search/sources";
import { cn } from "@/lib/utils";
import { usePathname, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { getIconComponent } from "@/lib/sidebar/v2/icon-map";
import { isItemActive } from "@/lib/sidebar/v2/active";
import { resolveSidebarLabel } from "@/lib/sidebar/v2/label";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";

// ---------------------------------------------------------------------------
// Sub-leaf: deepest level item (no children)
// ---------------------------------------------------------------------------
function NavSubLeaf({
  item,
  active,
  getLabel,
}: {
  item: SidebarItem;
  active: boolean;
  getLabel: (item: SidebarItem) => string;
}) {
  const Icon = getIconComponent(item.iconKey);
  const label = getLabel(item);

  if (item.disabledReason) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton className="opacity-50 cursor-not-allowed">
          <Icon />
          <span>{label}</span>
          {item.disabledReason === "coming_soon" && (
            <span className="ml-auto text-[10px] font-medium">Soon</span>
          )}
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      {item.href ? (
        <SidebarMenuSubButton asChild isActive={active}>
          <Link href={toUnsafeI18nHref(item.href)}>
            <Icon />
            <span>{label}</span>
          </Link>
        </SidebarMenuSubButton>
      ) : (
        <SidebarMenuSubButton isActive={active}>
          <Icon />
          <span>{label}</span>
        </SidebarMenuSubButton>
      )}
    </SidebarMenuSubItem>
  );
}

// ---------------------------------------------------------------------------
// L2 item: can be a leaf or a collapsible group (with L3 leaves)
// ---------------------------------------------------------------------------
function NavL2Item({
  item,
  pathname,
  getLabel,
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  // G2: skip isItemActive computation for disabled items
  const active = item.disabledReason ? false : isItemActive(item, pathname);

  if (!item.children?.length) {
    return <NavSubLeaf item={item} active={active} getLabel={getLabel} />;
  }

  const Icon = getIconComponent(item.iconKey);

  if (item.disabledReason) {
    // G1: disabled groups remain expandable (no pointer-events-none on trigger)
    return (
      <SidebarMenuSubItem>
        <Collapsible defaultOpen={false} className="group/l2">
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton className="opacity-50 cursor-not-allowed w-full">
              <Icon />
              <span>{getLabel(item)}</span>
              <span className="ml-auto flex items-center gap-2">
                {item.disabledReason === "coming_soon" && (
                  <span className="text-[10px] font-medium">Soon</span>
                )}
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    "group-data-[state=open]/l2:rotate-90"
                  )}
                />
              </span>
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child) => (
                <NavSubLeaf
                  key={child.id}
                  item={child}
                  active={child.disabledReason ? false : isItemActive(child, pathname)}
                  getLabel={getLabel}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <Collapsible defaultOpen={active} className="group/l2">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="cursor-pointer w-full">
            <Icon />
            <span>{getLabel(item)}</span>
            <ChevronRight
              className={cn(
                "ml-auto size-3.5 transition-transform duration-200",
                "group-data-[state=open]/l2:rotate-90"
              )}
            />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <NavSubLeaf
                key={child.id}
                item={child}
                active={isItemActive(child, pathname)}
                getLabel={getLabel}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}

// ---------------------------------------------------------------------------
// Collapsed sidebar flyout system
//
// One controller for the whole sidebar: at most one flyout is open at a time,
// and opening another closes the previous one at once (no overlap).
// floating-ui drives the interaction -- hover with a safe polygon towards the
// sub-columns, keyboard focus, tap on touch screens, and dismissal (Escape,
// press outside, scroll); the controller also closes on navigation, window
// blur/resize and when the sidebar expands.
// The whole flyout, the stretched root row included, renders in ONE portal
// layer above the app (--z-sidebar-flyout), so nothing on the page can cover
// any part of it, and the icon in the sidebar never changes its layout under
// the pointer. The look and the animations are unchanged.
// ---------------------------------------------------------------------------

const FLYOUT_W = 220;
const FLYOUT_ROW_H = 38;
const FLYOUT_CLOSE_DELAY = 120;

const iconHoverSpring = { type: "spring", stiffness: 520, damping: 28, mass: 0.35 } as const;

const flyoutIconHoverVariants: import("framer-motion").Variants = {
  rest: {
    scale: 1,
    transition: iconHoverSpring,
  },
  hover: {
    transition: iconHoverSpring,
  },
};

type FlyoutRowRadiusRole = "title" | "item";

type FlyoutController = {
  openId: string | null;
  setOpenId: (update: (current: string | null) => string | null) => void;
  /**
   * The flyout that Escape or a window blur closed. The flyout covers its icon,
   * so once it is gone the still pointer "enters" the icon again: hover may not
   * reopen it until the pointer leaves the icon (or the window gets focus back).
   */
  dismissedId: React.MutableRefObject<string | null>;
};

const FlyoutControllerContext = createContext<FlyoutController | null>(null);

/** The single source of truth of which collapsed-sidebar flyout is open. */
function FlyoutControllerProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenIdState] = useState<string | null>(null);
  const dismissedId = useRef<string | null>(null);
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();

  const setOpenId = useCallback(
    (update: (current: string | null) => string | null) => setOpenIdState(update),
    []
  );

  // Navigation, an expanded sidebar, leaving the window or resizing it close any flyout.
  useEffect(() => {
    setOpenIdState(null);
  }, [pathname, sidebarState]);
  useEffect(() => {
    const close = () => setOpenIdState(null);
    const blur = () =>
      setOpenIdState((current) => {
        dismissedId.current = current;
        return null;
      });
    const focus = () => {
      dismissedId.current = null;
    };
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      window.removeEventListener("resize", close);
    };
  }, []);

  const value = useMemo(() => ({ openId, setOpenId, dismissedId }), [openId, setOpenId]);
  return (
    <FlyoutControllerContext.Provider value={value}>{children}</FlyoutControllerContext.Provider>
  );
}

function useFlyoutController(): FlyoutController {
  const ctrl = useContext(FlyoutControllerContext);
  if (!ctrl) throw new Error("useFlyoutController outside FlyoutControllerProvider");
  return ctrl;
}

function getFlyoutRowRadius({
  role,
  index,
  total,
}: {
  role: FlyoutRowRadiusRole;
  index?: number;
  total?: number;
}) {
  if (role === "title") return "rounded-tr-sm";
  if (typeof index === "number" && typeof total === "number" && index === total - 1) {
    return "rounded-br-sm";
  }
  return "rounded-none";
}

// `custom` = true when another flyout took over: the old one goes at once,
// so two flyouts are never on screen together.
const flyoutColumnVariants: import("framer-motion").Variants = {
  initial: { opacity: 0, x: -4 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.11, ease: "easeOut", staggerChildren: 0.025, delayChildren: 0.015 },
  },
  exit: (instant: boolean) =>
    instant
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, x: -4, transition: { duration: 0.08, ease: "easeIn" } },
};

const flyoutRowVariants: import("framer-motion").Variants = {
  initial: { opacity: 0, y: -3 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.09, ease: "easeOut" },
  },
  exit: (instant: boolean) =>
    instant
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, y: -3, transition: { duration: 0.06, ease: "easeIn" } },
};

function FlyoutRowContent({
  item,
  label,
  showIcon = true,
  showChevron,
  expanded,
}: {
  item: SidebarItem;
  label: string;
  showIcon?: boolean;
  showChevron?: boolean;
  expanded?: boolean;
}) {
  const Icon = getIconComponent(item.iconKey);

  return (
    <span className="relative flex w-full min-w-0 items-center">
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5",
          expanded && "translate-x-0.5",
          showChevron && "pr-7"
        )}
      >
        {showIcon && (
          <motion.span
            variants={flyoutIconHoverVariants}
            className="flex size-3.5 shrink-0 items-center justify-center will-change-transform"
          >
            <Icon className="size-3.5 shrink-0" />
          </motion.span>
        )}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {item.disabledReason === "coming_soon" && (
          <span className="text-[10px] font-medium">Soon</span>
        )}
      </span>
      {showChevron && (
        <ChevronRight
          className={cn(
            "absolute right-2.5 top-1/2 size-3 -translate-y-1/2 shrink-0 opacity-55 transition-transform duration-200 ease-out",
            expanded && "rotate-90 opacity-75"
          )}
        />
      )}
    </span>
  );
}

function FlyoutRootRowContent({
  item,
  label,
  iconSlotWidth,
  expanded,
}: {
  item: SidebarItem;
  label: string;
  iconSlotWidth: number;
  expanded: boolean;
}) {
  const Icon = getIconComponent(item.iconKey);

  return (
    <span className="relative flex h-full w-full min-w-0 items-center">
      <span
        className="flex h-full shrink-0 items-center justify-center"
        style={{ width: iconSlotWidth }}
      >
        <motion.span
          variants={flyoutIconHoverVariants}
          className="flex size-4 shrink-0 items-center justify-center will-change-transform"
        >
          <Icon className="size-4 shrink-0" />
        </motion.span>
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 pr-7 text-[13px] leading-normal transition-opacity duration-100 ease-out",
          expanded ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {item.disabledReason === "coming_soon" && (
          <span className="text-[10px] font-medium">Soon</span>
        )}
      </span>
      <ChevronRight
        className={cn(
          "absolute right-2.5 top-1/2 size-3 -translate-y-1/2 opacity-0 transition-[opacity,transform] duration-150 ease-out",
          expanded && "rotate-90 opacity-75"
        )}
      />
    </span>
  );
}

function FlyoutRow({
  item,
  pathname,
  getLabel,
  expanded,
  stretched,
  index,
  total,
  onMouseEnter,
  onNavigate,
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
  expanded?: boolean;
  stretched?: boolean;
  index: number;
  total: number;
  onMouseEnter?: () => void;
  /** A link was chosen: the flyout closes right away */
  onNavigate?: () => void;
}) {
  const label = getLabel(item);
  const hasChildren = !!item.children?.length;
  const routeActive = item.disabledReason ? false : isItemActive(item, pathname);

  const className = cn(
    "group relative flex items-center gap-1.5 px-2.5 text-[13px] leading-normal select-none overflow-visible",
    "transition-[width,background-color,color,border-radius,box-shadow] duration-150 ease-out",
    stretched ? "" : "w-full",
    getFlyoutRowRadius({ role: stretched ? "title" : "item", index, total }),
    routeActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : expanded
        ? "bg-muted text-sidebar-foreground"
        : "text-sidebar-foreground hover:bg-muted",
    item.disabledReason && "opacity-50 cursor-not-allowed"
  );

  if (item.href && !hasChildren && !item.disabledReason) {
    return (
      <motion.div initial="rest" animate="rest" whileHover="hover" transition={iconHoverSpring}>
        <Link
          href={toUnsafeI18nHref(item.href)}
          className={className}
          style={{ width: stretched ? FLYOUT_W * 2 : undefined, height: FLYOUT_ROW_H }}
          onMouseEnter={onMouseEnter}
          onClick={onNavigate}
          role="menuitem"
        >
          <FlyoutRowContent item={item} label={label} showChevron={false} expanded={expanded} />
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      initial="rest"
      animate="rest"
      whileHover="hover"
      transition={iconHoverSpring}
      className={className}
      style={{ width: stretched ? FLYOUT_W * 2 : undefined, height: FLYOUT_ROW_H }}
      onMouseEnter={onMouseEnter}
      disabled={!!item.disabledReason && !hasChildren}
      role="menuitem"
      aria-haspopup={hasChildren ? "menu" : undefined}
      aria-expanded={hasChildren ? !!expanded : undefined}
    >
      <FlyoutRowContent item={item} label={label} showChevron={hasChildren} expanded={expanded} />
    </motion.button>
  );
}

function NavL1Flyout({
  item,
  pathname,
  getLabel,
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  const { openId, setOpenId, dismissedId } = useFlyoutController();
  const open = openId === item.id;
  // Another flyout took over: this one leaves without its exit animation.
  const replaced = !open && openId !== null;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [activeL2, setActiveL2] = useState<SidebarItem | null>(null);

  const Icon = getIconComponent(item.iconKey);
  const label = getLabel(item);
  const routeActive = item.disabledReason ? false : isItemActive(item, pathname);
  const rootChildren = item.children ?? [];

  const onOpenChange = useCallback(
    (next: boolean, _event?: Event, reason?: string) => {
      if (next && reason === "hover" && dismissedId.current === item.id) return;
      if (next) dismissedId.current = null;
      else if (reason === "escape-key") dismissedId.current = item.id;
      setOpenId((current) => (next ? item.id : current === item.id ? null : current));
    },
    [item.id, setOpenId, dismissedId]
  );
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const { refs, context, elements } = useFloating({ open, onOpenChange, strategy: "fixed" });
  const hover = useHover(context, {
    mouseOnly: true,
    delay: { open: 0, close: FLYOUT_CLOSE_DELAY },
    handleClose: safePolygon({ buffer: 2 }),
  });
  const focus = useFocus(context, { visibleOnly: true });
  const tap = useClick(context, { ignoreMouse: true });
  const dismiss = useDismiss(context, { ancestorScroll: true });
  const role = useRole(context, { role: "menu" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    tap,
    dismiss,
    role,
  ]);

  // The flyout is anchored to the icon's slot, measured before paint so the
  // stretched row covers the icon in the very first frame.
  useLayoutEffect(() => {
    if (open && elements.domReference) {
      setRect(elements.domReference.getBoundingClientRect());
    }
    if (!open) setActiveL2(null);
  }, [open, elements.domReference]);

  const activeL2Index = activeL2 ? rootChildren.findIndex((child) => child.id === activeL2.id) : -1;
  const l2Rows = activeL2?.children?.length ?? 0;

  return (
    <SidebarMenuItem className="relative h-8">
      <motion.div
        ref={refs.setReference}
        tabIndex={0}
        aria-label={label}
        data-testid="sidebar-flyout-trigger"
        data-state={open ? "open" : "closed"}
        initial="rest"
        animate="rest"
        whileHover="hover"
        transition={iconHoverSpring}
        {...getReferenceProps({
          onMouseLeave: () => {
            if (dismissedId.current === item.id) dismissedId.current = null;
          },
        })}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-sm outline-none",
          "text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "transition-[background-color,color] duration-150 ease-out",
          routeActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : open
              ? "bg-muted text-sidebar-foreground"
              : "bg-transparent text-sidebar-foreground"
        )}
      >
        <motion.span
          variants={flyoutIconHoverVariants}
          className="flex size-4 shrink-0 items-center justify-center will-change-transform"
        >
          <Icon className="size-4 shrink-0" />
        </motion.span>
      </motion.div>

      <FloatingPortal>
        {/* Another flyout took over: this one is removed at once, even mid-exit,
            so two flyouts are never on screen together. */}
        {!replaced && (
          <AnimatePresence custom={replaced}>
            {open && rect && (
              <motion.div
                key={item.id}
                ref={refs.setFloating}
                {...getFloatingProps()}
                data-testid="sidebar-flyout"
                data-flyout-id={item.id}
                initial="initial"
                animate="animate"
                exit="exit"
                custom={replaced}
                // A zero-size anchor at the icon: only the rows and columns catch the
                // pointer, so the empty space around them (the other sidebar icons)
                // neither blocks the pointer nor keeps the flyout open.
                className="pointer-events-none fixed"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: 0,
                  height: 0,
                  zIndex: "var(--z-sidebar-flyout)",
                }}
              >
                {/* Stretched root row: drawn over the icon, grows to the column's width */}
                <motion.div
                  className={cn(
                    "pointer-events-auto absolute left-0 top-0 flex items-center justify-start overflow-hidden rounded-sm",
                    routeActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "bg-muted text-sidebar-foreground"
                  )}
                  style={{ height: rect.height }}
                  initial={{ width: rect.width }}
                  animate={{
                    width: rect.width + FLYOUT_W,
                    transition: { duration: 0.15, ease: "easeOut" },
                  }}
                  exit={
                    replaced
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { width: rect.width, transition: { duration: 0.1, ease: "easeIn" } }
                  }
                >
                  <FlyoutRootRowContent
                    item={item}
                    label={label}
                    iconSlotWidth={rect.width}
                    expanded
                  />
                </motion.div>

                <motion.div
                  variants={flyoutColumnVariants}
                  custom={replaced}
                  className="pointer-events-auto absolute overflow-visible bg-sidebar"
                  style={{ left: rect.width, top: rect.height, width: FLYOUT_W }}
                >
                  {rootChildren.map((child, index) => {
                    const hasChildren = !!child.children?.length;
                    const isExpanded = activeL2?.id === child.id;
                    return (
                      <motion.div
                        key={child.id}
                        variants={flyoutRowVariants}
                        custom={replaced}
                        className="relative p-0"
                        style={{ height: FLYOUT_ROW_H }}
                      >
                        <FlyoutRow
                          item={child}
                          pathname={pathname}
                          getLabel={getLabel}
                          expanded={isExpanded}
                          stretched={isExpanded && hasChildren}
                          index={index}
                          total={rootChildren.length}
                          onMouseEnter={() => setActiveL2(hasChildren ? child : null)}
                          onNavigate={close}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>

                <AnimatePresence mode="wait" custom={replaced}>
                  {activeL2 && l2Rows > 0 && activeL2Index >= 0 && (
                    <motion.div
                      key={activeL2.id}
                      variants={flyoutColumnVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      custom={replaced}
                      className="pointer-events-auto absolute bg-sidebar"
                      style={{
                        left: rect.width + FLYOUT_W,
                        top: rect.height + (activeL2Index + 1) * FLYOUT_ROW_H,
                        width: FLYOUT_W,
                      }}
                    >
                      {activeL2.children!.map((child, index) => (
                        <motion.div
                          key={child.id}
                          variants={flyoutRowVariants}
                          custom={replaced}
                          style={{ height: FLYOUT_ROW_H }}
                        >
                          <FlyoutRow
                            item={child}
                            pathname={pathname}
                            getLabel={getLabel}
                            index={index}
                            total={l2Rows}
                            onNavigate={close}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </FloatingPortal>
    </SidebarMenuItem>
  );
}

// L1 item: top-level — leaf or collapsible group (with L2 children)
// ---------------------------------------------------------------------------
function NavL1Item({
  item,
  pathname,
  getLabel,
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  const { state: sidebarState } = useSidebar();
  const Icon = getIconComponent(item.iconKey);
  // G2: skip isItemActive computation for disabled items
  const active = item.disabledReason ? false : isItemActive(item, pathname);
  const label = getLabel(item);

  // Controlled open state for collapsible groups — auto-opens when a child becomes active.
  // Hooks must be at the top level (before any early returns) per Rules of Hooks.
  const [isOpen, setIsOpen] = useState(active);
  useEffect(() => {
    if (active) setIsOpen(true);
  }, [active]);

  // When collapsed and item has children, use hover flyout instead of collapsible
  if (sidebarState === "collapsed" && item.children?.length) {
    return <NavL1Flyout item={item} pathname={pathname} getLabel={getLabel} />;
  }

  if (!item.children?.length) {
    if (item.disabledReason) {
      // G3: keep pointer events so tooltip still works; cursor communicates disabled state
      return (
        <SidebarMenuItem>
          <SidebarMenuButton tooltip={label} className="opacity-50 cursor-not-allowed">
            <Icon />
            <span>{label}</span>
            {item.disabledReason === "coming_soon" && (
              <span className="ml-auto text-[10px] font-medium">Soon</span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem>
        {item.href ? (
          <SidebarMenuButton asChild tooltip={label} isActive={active}>
            <Link href={toUnsafeI18nHref(item.href)}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton tooltip={label} isActive={active}>
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  }

  if (item.disabledReason) {
    // G1: disabled groups remain expandable (no pointer-events-none on trigger)
    return (
      <Collapsible asChild defaultOpen={false} className="group/l1">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={label} className="opacity-50 cursor-not-allowed">
              <Icon />
              <span>{label}</span>
              <span className="ml-auto flex items-center gap-2">
                {item.disabledReason === "coming_soon" && (
                  <span className="text-[10px] font-medium">Soon</span>
                )}
                <ChevronRight
                  className={cn(
                    "transition-transform duration-200",
                    "group-data-[state=open]/l1:rotate-90"
                  )}
                />
              </span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child) => (
                <NavL2Item key={child.id} item={child} pathname={pathname} getLabel={getLabel} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <Collapsible asChild open={isOpen} onOpenChange={setIsOpen} className="group/l1">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={label} isActive={active}>
            <Icon />
            <span>{label}</span>
            <ChevronRight
              className={cn(
                "ml-auto transition-transform duration-200",
                "group-data-[state=open]/l1:rotate-90"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <NavL2Item key={child.id} item={child} pathname={pathname} getLabel={getLabel} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// NavSection: renders a group of L1 items
// ---------------------------------------------------------------------------
function NavSection({
  items,
  pathname,
  getLabel,
}: {
  items: SidebarItem[];
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  if (!items.length) return null;
  return (
    <SidebarGroup>
      <SidebarMenu className="gap-4 py-2">
        {items.map((item) => (
          <NavL1Item key={item.id} item={item} pathname={pathname} getLabel={getLabel} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

// ---------------------------------------------------------------------------
// AppSidebar
// ---------------------------------------------------------------------------
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  model: SidebarModel;
  isAdmin?: boolean;
  accessibleBranches: BranchDataV2[];
  activeBranchId: string | null;
}

function AppSidebar({
  model,
  isAdmin,
  accessibleBranches,
  activeBranchId,
  ...props
}: AppSidebarProps) {
  const { user } = useUserStoreV2();
  const pathname = usePathname();
  const t = useTranslations();
  const translator = useMemo(() => ({ t, has: t.has }), [t]);
  const getItemLabel = useCallback(
    (item: SidebarItem) => resolveSidebarLabel(item, translator),
    [translator]
  );

  const userData = user
    ? {
        name: getUserDisplayName(user.first_name, user.last_name),
        email: user.email || "",
        avatar: user.avatar_signed_url || user.avatar_url || "",
      }
    : {
        name: "User",
        email: "",
        avatar: "",
      };

  // Split main nav into display groups, preserving item order.
  // Consecutive items sharing the same `group` key are bundled together.
  // Items with no group each form their own implicit group.
  const itemGroups = useMemo(() => {
    const groups: (typeof model.main)[] = [];
    let currentGroup: typeof model.main = [];
    let currentKey: string | undefined;

    for (const item of model.main) {
      const key = item.group ?? `__solo__${item.id}`;
      if (key !== currentKey) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [item];
        currentKey = key;
      } else {
        currentGroup.push(item);
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
  }, [model.main]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="bg-muted border-b">
        <SidebarOrgHeader />
        <SidebarBranchSwitcher branches={accessibleBranches} activeBranchId={activeBranchId} />
      </SidebarHeader>
      <SidebarContent>
        <FlyoutControllerProvider>
          {itemGroups.map((groupItems, i) => (
            <Fragment key={groupItems[0]?.id ?? i}>
              {i > 0 && <div className="mx-2 h-px shrink-0 bg-border/50" />}
              <NavSection items={groupItems} pathname={pathname} getLabel={getItemLabel} />
            </Fragment>
          ))}
          <NavSection items={model.footer} pathname={pathname} getLabel={getItemLabel} />
        </FlyoutControllerProvider>
      </SidebarContent>
      <SidebarFooter className="bg-muted border-t">
        <NavUser user={userData} isAdmin={isAdmin} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// DashboardShell
// ---------------------------------------------------------------------------
interface DashboardShellProps {
  children: React.ReactNode;
  sidebarModel: SidebarModel;
  /** Server-resolved global search entries (pages + actions) */
  searchEntries?: SearchEntry[];
  /** Data sources the user may search (scope chips) */
  searchSources?: SearchSourceId[];
  isAdmin?: boolean;
  /** Server-computed accessible branches — passed through to the branch switcher */
  accessibleBranches: BranchDataV2[];
  /** Server-resolved active branch ID */
  activeBranchId: string | null;
  /** SSR-fetched single latest event for the status bar preview */
  initialLatestEvent: import("@/server/audit/types").ProjectedEvent | null;
}

export function DashboardShell({
  children,
  sidebarModel,
  searchEntries,
  searchSources,
  isAdmin,
  accessibleBranches,
  activeBranchId,
  initialLatestEvent,
}: DashboardShellProps) {
  const sidebarCollapsed = useUiStoreV2((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStoreV2((s) => s.setSidebarCollapsed);
  const flushContent = useUiStoreV2((s) => s.flushContent);

  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarCollapsed(!open);
  };

  return (
    <SidebarProvider open={!sidebarCollapsed} onOpenChange={handleSidebarOpenChange}>
      <AppSidebar
        model={sidebarModel}
        isAdmin={isAdmin}
        accessibleBranches={accessibleBranches}
        activeBranchId={activeBranchId}
      />
      {/* Sources the user may search: the Ctrl+K palette and "@" mentions in every editor */}
      <SearchSourcesProvider sources={searchSources}>
        {/* Messages: the right bar and chat windows sit next to the page (users with messages.use) */}
        <MessagesRoot>
          <SidebarInset className="flex h-svh min-h-0 flex-col overflow-hidden">
            <DashboardHeaderV2 searchEntries={searchEntries} searchSources={searchSources} />
            <main
              className={
                flushContent
                  ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                  : "min-h-0 flex-1 overflow-auto p-4 pb-12"
              }
            >
              {children}
            </main>
            <DashboardStatusBar initialLatestEvent={initialLatestEvent} />
          </SidebarInset>
        </MessagesRoot>
      </SearchSourcesProvider>
    </SidebarProvider>
  );
}
