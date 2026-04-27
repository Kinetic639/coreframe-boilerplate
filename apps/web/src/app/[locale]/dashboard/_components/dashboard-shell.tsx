"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
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
import { createPortal } from "react-dom";
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
// Collapsed sidebar flyout system — stable native-style menu
//
// Important design decision:
// The first collapsed icon is NOT cloned into a portal anymore.
// The real trigger element itself becomes the stretched root row and then
// shrinks back. This removes the one-frame flash caused by swapping between
// a hidden sidebar icon and a portal copy.
// ---------------------------------------------------------------------------

const FLYOUT_W = 220;
const FLYOUT_ROW_H = 30;
const FLYOUT_CLOSE_DELAY = 140;
const ROOT_TRANSITION_MS = 145;

type FlyoutRowRadiusRole = "title" | "item";

type FlyoutRootState = {
  item: SidebarItem;
  rect: DOMRect;
};

type FlyoutMode = "closed" | "open" | "closing";

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

function useFlyoutDelay() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const closeLater = useCallback(
    (close: () => void) => {
      cancel();
      timer.current = setTimeout(close, FLYOUT_CLOSE_DELAY);
    },
    [cancel]
  );

  useEffect(() => cancel, [cancel]);

  return { cancel, closeLater };
}

const flyoutColumnVariants: import("framer-motion").Variants = {
  initial: { opacity: 0, x: -4 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.11, ease: "easeOut", staggerChildren: 0.025, delayChildren: 0.015 },
  },
  exit: { opacity: 0, x: -4, transition: { duration: 0.08, ease: "easeIn" } },
};

const flyoutRowVariants: import("framer-motion").Variants = {
  initial: { opacity: 0, y: -3 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.09, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -3, transition: { duration: 0.06, ease: "easeIn" } },
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
        {showIcon && <Icon className="size-3.5 shrink-0" />}
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
        <Icon className="size-4 shrink-0" />
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 pr-7 text-[13px] leading-none transition-opacity duration-100 ease-out",
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
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
  expanded?: boolean;
  stretched?: boolean;
  index: number;
  total: number;
  onMouseEnter?: () => void;
}) {
  const label = getLabel(item);
  const hasChildren = !!item.children?.length;
  const routeActive = item.disabledReason ? false : isItemActive(item, pathname);

  const className = cn(
    "group relative z-20 flex items-center gap-1.5 px-2.5 text-[13px] leading-none select-none overflow-visible",
    "transition-[width,background-color,color,border-radius,box-shadow] duration-150 ease-out",
    stretched ? "shadow-[0_8px_18px_rgba(0,0,0,0.14)]" : "w-full",
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
      <Link
        href={toUnsafeI18nHref(item.href)}
        className={className}
        style={{ width: stretched ? FLYOUT_W * 2 : undefined, height: FLYOUT_ROW_H }}
        onMouseEnter={onMouseEnter}
      >
        <FlyoutRowContent item={item} label={label} showChevron={false} expanded={expanded} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={{ width: stretched ? FLYOUT_W * 2 : undefined, height: FLYOUT_ROW_H }}
      onMouseEnter={onMouseEnter}
      disabled={!!item.disabledReason && !hasChildren}
    >
      <FlyoutRowContent item={item} label={label} showChevron={hasChildren} expanded={expanded} />
    </button>
  );
}

function CollapsedFlyoutLayer({
  root,
  visible,
  activeL2,
  setActiveL2,
  pathname,
  getLabel,
  keepOpen,
  closeLater,
  onClose,
}: {
  root: FlyoutRootState;
  visible: boolean;
  activeL2: SidebarItem | null;
  setActiveL2: (item: SidebarItem | null) => void;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
  keepOpen: () => void;
  closeLater: (close: () => void) => void;
  onClose: () => void;
}) {
  const rootChildren = root.item.children ?? [];
  const activeL2Index = activeL2 ? rootChildren.findIndex((child) => child.id === activeL2.id) : -1;

  const l1ColumnLeft = root.rect.left + root.rect.width;
  const l1ColumnTop = root.rect.top + root.rect.height;
  const l2ColumnLeft = root.rect.left + root.rect.width + FLYOUT_W;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            key={`${root.item.id}-l1`}
            variants={flyoutColumnVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="pointer-events-auto fixed z-[89] overflow-visible bg-sidebar shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
            style={{ left: l1ColumnLeft, top: l1ColumnTop, width: FLYOUT_W }}
            onMouseEnter={keepOpen}
            onMouseLeave={() => closeLater(onClose)}
          >
            {rootChildren.map((child, index) => {
              const hasChildren = !!child.children?.length;
              const isExpanded = activeL2?.id === child.id;

              return (
                <motion.div
                  key={child.id}
                  variants={flyoutRowVariants}
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
                    onMouseEnter={() => {
                      keepOpen();
                      setActiveL2(hasChildren ? child : null);
                    }}
                  />
                </motion.div>
              );
            })}
          </motion.div>

          <AnimatePresence mode="wait">
            {activeL2 && activeL2.children?.length && activeL2Index >= 0 && (
              <motion.div
                key={activeL2.id}
                variants={flyoutColumnVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{
                  position: "fixed",
                  left: l2ColumnLeft,
                  top: l1ColumnTop + (activeL2Index + 1) * FLYOUT_ROW_H,
                  width: FLYOUT_W,
                }}
                className="pointer-events-auto z-[88] bg-sidebar shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
                onMouseEnter={keepOpen}
                onMouseLeave={() => closeLater(onClose)}
              >
                {activeL2.children.map((child, index) => (
                  <motion.div
                    key={child.id}
                    variants={flyoutRowVariants}
                    style={{ height: FLYOUT_ROW_H }}
                  >
                    <FlyoutRow
                      item={child}
                      pathname={pathname}
                      getLabel={getLabel}
                      index={index}
                      total={activeL2.children?.length ?? 0}
                      onMouseEnter={keepOpen}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>,
    document.body
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
  const [root, setRoot] = useState<FlyoutRootState | null>(null);
  const [mode, setMode] = useState<FlyoutMode>("closed");
  const [activeL2, setActiveL2] = useState<SidebarItem | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeFinishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cancel, closeLater } = useFlyoutDelay();

  const Icon = getIconComponent(item.iconKey);
  const label = getLabel(item);
  const routeActive = item.disabledReason ? false : isItemActive(item, pathname);
  const isOpenish = mode === "open" || mode === "closing";
  const expanded = mode === "open";
  const rect = root?.rect;

  const clearCloseFinishTimer = useCallback(() => {
    if (closeFinishTimer.current) {
      clearTimeout(closeFinishTimer.current);
      closeFinishTimer.current = null;
    }
  }, []);

  useEffect(() => clearCloseFinishTimer, [clearCloseFinishTimer]);

  const openFlyout = useCallback(() => {
    cancel();
    clearCloseFinishTimer();

    // Critical: once the root has opened, keep the original sidebar-slot rect.
    // Re-reading getBoundingClientRect() while the root is fixed + stretched makes
    // the flyout anchor jump away from the pointer when entering child panels.
    if (root) {
      setMode("open");
      return;
    }

    if (triggerRef.current) {
      const nextRect = triggerRef.current.getBoundingClientRect();
      setRoot({ item, rect: nextRect });
      setMode("open");
    }
  }, [cancel, clearCloseFinishTimer, item, root]);

  const closeFlyout = useCallback(() => {
    if (mode === "closed") return;

    cancel();
    setMode("closing");
    setActiveL2(null);

    clearCloseFinishTimer();
    closeFinishTimer.current = setTimeout(() => {
      setMode("closed");
      setRoot(null);
    }, ROOT_TRANSITION_MS);
  }, [cancel, clearCloseFinishTimer, mode]);

  const rootWidth = rect ? (expanded ? rect.width + FLYOUT_W : rect.width) : undefined;
  const rootHeight = rect?.height ?? 32;

  return (
    <SidebarMenuItem className="relative h-8">
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        onMouseEnter={openFlyout}
        onMouseLeave={() => closeLater(closeFlyout)}
        onFocus={openFlyout}
        onBlur={() => closeLater(closeFlyout)}
        className={cn(
          "z-[90] flex items-center justify-center overflow-hidden outline-none",
          "text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "transition-[width,background-color,color,border-radius,box-shadow] duration-150 ease-out",
          isOpenish
            ? cn(
                "fixed justify-start rounded-sm shadow-[0_8px_18px_rgba(0,0,0,0.14)]",
                routeActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "bg-muted text-sidebar-foreground"
              )
            : cn(
                "relative h-8 w-8 rounded-sm",
                routeActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "bg-transparent text-sidebar-foreground"
              )
        )}
        style={
          isOpenish && rect
            ? {
                left: rect.left,
                top: rect.top,
                width: rootWidth,
                height: rootHeight,
              }
            : undefined
        }
      >
        {isOpenish && rect ? (
          <FlyoutRootRowContent
            item={item}
            label={label}
            iconSlotWidth={rect.width}
            expanded={expanded}
          />
        ) : (
          <Icon className="size-4 shrink-0" />
        )}
      </div>

      {root && (
        <CollapsedFlyoutLayer
          root={root}
          visible={mode === "open"}
          activeL2={activeL2}
          setActiveL2={setActiveL2}
          pathname={pathname}
          getLabel={getLabel}
          keepOpen={openFlyout}
          closeLater={closeLater}
          onClose={closeFlyout}
        />
      )}
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

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="bg-muted border-b">
        <SidebarOrgHeader />
        <SidebarBranchSwitcher branches={accessibleBranches} activeBranchId={activeBranchId} />
      </SidebarHeader>
      <SidebarContent>
        <NavSection items={model.main} pathname={pathname} getLabel={getItemLabel} />
        <NavSection items={model.footer} pathname={pathname} getLabel={getItemLabel} />
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
      <SidebarInset className="flex flex-col">
        <DashboardHeaderV2 />
        <main
          className={
            flushContent ? "flex flex-col flex-1 overflow-hidden" : "flex-1 overflow-auto p-4 pb-12"
          }
        >
          {children}
        </main>
        <DashboardStatusBar initialLatestEvent={initialLatestEvent} />
      </SidebarInset>
    </SidebarProvider>
  );
}
