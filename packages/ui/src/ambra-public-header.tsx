"use client";

import type { ComponentType, ElementType, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Archive,
  Barcode,
  BarChart,
  Bell,
  BookOpen,
  Building,
  Factory,
  FileText,
  GraduationCap,
  Hammer,
  Hospital,
  KanbanSquare,
  Menu,
  QrCode,
  RefreshCw,
  Settings as GearIcon,
  Smartphone,
  Truck,
  Wrench,
  X,
  ChevronDown,
} from "lucide-react";
import { BrandLockup } from "./branding";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";
import { cn } from "./utils";

interface LinkLikeProps {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

export interface AmbraPublicHeaderMenuItem {
  icon: ElementType;
  title: string;
  description?: string;
  href: string;
}

export interface AmbraPublicHeaderMenuGroup {
  category?: string;
  items: AmbraPublicHeaderMenuItem[];
}

export interface AmbraPublicHeaderDropdown {
  id: string;
  label: string;
  description?: string;
  groups: AmbraPublicHeaderMenuGroup[];
  contentClassName?: string;
  groupClassName?: string;
  groupsClassName?: string;
  itemsClassName?: string;
}

export interface AmbraPublicHeaderTopLink {
  label: string;
  href: string;
}

export interface AmbraPublicHeaderConfig {
  homeHref?: string;
  dropdowns: AmbraPublicHeaderDropdown[];
  topLinks?: AmbraPublicHeaderTopLink[];
}

interface AmbraPublicHeaderProps {
  LinkComponent?: ComponentType<LinkLikeProps>;
  config: AmbraPublicHeaderConfig;
  authActions?: ReactNode;
  mobileAuthActions?: ReactNode;
  /** aria-label when the mobile menu is open (shown on the close/X button). */
  closeMenuLabel?: string;
  /** aria-label when the mobile menu is closed (shown on the open/hamburger button). */
  openMenuLabel?: string;
  /** Prefix shown before a lowercased dropdown title in the mobile "view all" link, e.g. "All" -> "All solutions". */
  allLabel?: string;
}

// Icon assignments for the standard Ambra marketing nav. Content (titles,
// descriptions, labels) is locale-specific and must come from each app's own
// translations via `config` -- this module intentionally has no hardcoded
// copy so it can't silently default to one language. See
// apps/web/src/components/Header/PublicHeaderClient.tsx (or the equivalent in
// apps/public-web) for how `config` is built from `useTranslations()`.
export const AMBRA_PUBLIC_HEADER_ICONS = {
  features: {
    mobile: Smartphone,
    qr: QrCode,
    alerts: Bell,
    barcode: Barcode,
    integrations: GearIcon,
    reporting: BarChart,
  },
  solutions: {
    warehouseManagement: Archive,
    deliveryTracking: Truck,
    assetTracking: Hammer,
    construction: Building,
    healthcare: Hospital,
    manufacturing: Factory,
    education: GraduationCap,
    serviceRepair: Wrench,
  },
  educational: {
    blog: FileText,
    knowledgeBase: BookOpen,
    updates: RefreshCw,
    roadmap: KanbanSquare,
  },
} as const;

/**
 * Single source of truth for the standard Ambra marketing header's content
 * *structure* (which dropdowns/items exist, their hrefs, their translation
 * keys) -- both apps/web and apps/public-web call this with their own
 * `useTranslations("PublicHeader")` result so the two headers can never drift
 * out of sync. The `t` param only needs to match `(key: string) => string`
 * (next-intl's translator shape), so this module still has no direct
 * dependency on next-intl or either app's message catalog.
 */
export function buildAmbraPublicHeaderConfig({
  t,
  homeHref = "/",
  showPricing = true,
}: {
  t: (key: string) => string;
  homeHref?: string;
  showPricing?: boolean;
}): AmbraPublicHeaderConfig {
  const icons = AMBRA_PUBLIC_HEADER_ICONS;

  return {
    homeHref,
    dropdowns: [
      {
        id: "features",
        label: t("dropdowns.features.label"),
        description: t("dropdowns.features.description"),
        groups: [
          {
            items: [
              {
                icon: icons.features.mobile,
                title: t("dropdowns.features.items.mobile.title"),
                description: t("dropdowns.features.items.mobile.description"),
                href: "/features#mobile",
              },
              {
                icon: icons.features.qr,
                title: t("dropdowns.features.items.qr.title"),
                description: t("dropdowns.features.items.qr.description"),
                href: "/features#qr",
              },
              {
                icon: icons.features.alerts,
                title: t("dropdowns.features.items.alerts.title"),
                description: t("dropdowns.features.items.alerts.description"),
                href: "/features#alerts",
              },
              {
                icon: icons.features.barcode,
                title: t("dropdowns.features.items.barcode.title"),
                description: t("dropdowns.features.items.barcode.description"),
                href: "/features#barcode",
              },
              {
                icon: icons.features.integrations,
                title: t("dropdowns.features.items.integrations.title"),
                description: t("dropdowns.features.items.integrations.description"),
                href: "/features#integrations",
              },
              {
                icon: icons.features.reporting,
                title: t("dropdowns.features.items.reporting.title"),
                description: t("dropdowns.features.items.reporting.description"),
                href: "/features#reporting",
              },
            ],
          },
        ],
        contentClassName: "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6",
        itemsClassName: "grid w-full grid-cols-2 gap-3",
      },
      {
        id: "solutions",
        label: t("dropdowns.solutions.label"),
        description: t("dropdowns.solutions.description"),
        groups: [
          {
            category: t("dropdowns.solutions.useCasesCategory"),
            items: [
              {
                icon: icons.solutions.warehouseManagement,
                title: t("dropdowns.solutions.items.warehouseManagement.title"),
                description: t("dropdowns.solutions.items.warehouseManagement.description"),
                href: "/solutions/magazynowanie",
              },
              {
                icon: icons.solutions.deliveryTracking,
                title: t("dropdowns.solutions.items.deliveryTracking.title"),
                description: t("dropdowns.solutions.items.deliveryTracking.description"),
                href: "/solutions/dostawy",
              },
              {
                icon: icons.solutions.assetTracking,
                title: t("dropdowns.solutions.items.assetTracking.title"),
                description: t("dropdowns.solutions.items.assetTracking.description"),
                href: "/solutions/aktywa",
              },
            ],
          },
          {
            category: t("dropdowns.solutions.industriesCategory"),
            items: [
              {
                icon: icons.solutions.construction,
                title: t("dropdowns.solutions.items.construction.title"),
                description: t("dropdowns.solutions.items.construction.description"),
                href: "/solutions/budownictwo",
              },
              {
                icon: icons.solutions.healthcare,
                title: t("dropdowns.solutions.items.healthcare.title"),
                description: t("dropdowns.solutions.items.healthcare.description"),
                href: "/solutions/medycyna",
              },
              {
                icon: icons.solutions.manufacturing,
                title: t("dropdowns.solutions.items.manufacturing.title"),
                description: t("dropdowns.solutions.items.manufacturing.description"),
                href: "/solutions/produkcja",
              },
              {
                icon: icons.solutions.education,
                title: t("dropdowns.solutions.items.education.title"),
                description: t("dropdowns.solutions.items.education.description"),
                href: "/solutions/edukacja",
              },
              {
                icon: icons.solutions.serviceRepair,
                title: t("dropdowns.solutions.items.serviceRepair.title"),
                description: t("dropdowns.solutions.items.serviceRepair.description"),
                href: "/solutions/serwis",
              },
            ],
          },
        ],
        contentClassName: "grid w-[800px] grid-cols-[180px_1fr] gap-8 p-6",
        groupsClassName: "grid grid-cols-2 gap-x-6 gap-y-10",
        itemsClassName: "space-y-3",
      },
      {
        id: "educational",
        label: t("dropdowns.educational.label"),
        description: t("dropdowns.educational.description"),
        groups: [
          {
            category: t("dropdowns.educational.materialsCategory"),
            items: [
              {
                icon: icons.educational.blog,
                title: t("dropdowns.educational.items.blog.title"),
                description: t("dropdowns.educational.items.blog.description"),
                href: "/blog",
              },
              {
                icon: icons.educational.knowledgeBase,
                title: t("dropdowns.educational.items.knowledgeBase.title"),
                description: t("dropdowns.educational.items.knowledgeBase.description"),
                href: "/knowledge-base",
              },
              {
                icon: icons.educational.updates,
                title: t("dropdowns.educational.items.updates.title"),
                description: t("dropdowns.educational.items.updates.description"),
                href: "/updates",
              },
              {
                icon: icons.educational.roadmap,
                title: t("dropdowns.educational.items.roadmap.title"),
                description: t("dropdowns.educational.items.roadmap.description"),
                href: "/roadmap",
              },
            ],
          },
        ],
        contentClassName: "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6",
        groupsClassName: "grid grid-cols-2 gap-x-6 gap-y-4",
        itemsClassName: "grid grid-cols-2 gap-3",
      },
    ],
    topLinks: showPricing ? [{ label: t("pricing"), href: "/pricing" }] : [],
  };
}

function DefaultLink({ href, className, children, onClick }: LinkLikeProps) {
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

function MenuItemLink({
  item,
  LinkComponent,
}: {
  item: AmbraPublicHeaderMenuItem;
  LinkComponent: ComponentType<LinkLikeProps>;
}) {
  return (
    <NavigationMenuLink asChild>
      <LinkComponent
        href={item.href}
        className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-all duration-300 hover:bg-accent hover:text-primary focus:bg-accent focus:text-accent-foreground"
      >
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
            <item.icon className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium leading-none transition-all duration-300 group-hover:text-primary">
            {item.title}
          </div>
        </div>
        {item.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-snug text-muted-foreground transition-all duration-300 group-hover:text-muted-foreground/80">
            {item.description}
          </p>
        ) : null}
      </LinkComponent>
    </NavigationMenuLink>
  );
}

function HeaderDropdown({
  dropdown,
  LinkComponent,
}: {
  dropdown: AmbraPublicHeaderDropdown;
  LinkComponent: ComponentType<LinkLikeProps>;
}) {
  const grouped = dropdown.groups.length > 1 || dropdown.groups.some((group) => group.category);

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        // Radix's Trigger opens on hover already; its own click handler additionally
        // *toggles* open/closed on click, which reads as a bug here (hover reveals
        // the menu, then the same click that "activates" a hovered item immediately
        // closes it again). Radix composes this onClick with its internal toggle
        // handler and skips the internal one when the event's default is prevented
        // (same pattern as Radix's Slot: see
        // https://www.radix-ui.com/primitives/docs/utilities/slot -- "if an event
        // handler depends on event.defaultPrevented, ensure the order of execution
        // is correct"), so this disables click-to-toggle without touching hover.
        // Keyboard access is unaffected: Radix documents Enter/Space-opens-content
        // as its own keyboard interaction, separate from the click handler.
        onClick={(event) => event.preventDefault()}
      >
        {dropdown.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent className="transition-all duration-300 ease-in-out">
        <div
          className={dropdown.contentClassName ?? "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6"}
        >
          <div>
            <div className="group mb-4 flex items-center text-lg font-semibold tracking-tight transition-all duration-300 hover:text-primary">
              {dropdown.label}
              <span className="ml-1 inline-block transform opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                →
              </span>
            </div>
            {dropdown.description ? (
              <p className="pr-4 text-sm text-muted-foreground">{dropdown.description}</p>
            ) : null}
          </div>
          {grouped ? (
            <div className={dropdown.groupsClassName ?? "grid grid-cols-2 gap-x-6 gap-y-10"}>
              {dropdown.groups.map((group, index) => (
                <div
                  key={group.category ?? index}
                  className={dropdown.groupClassName ?? "space-y-3"}
                >
                  {group.category ? (
                    <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      {group.category}
                    </h4>
                  ) : null}
                  <ul className={dropdown.itemsClassName ?? "space-y-3"}>
                    {group.items.map((item) => (
                      <li key={item.title}>
                        <MenuItemLink item={item} LinkComponent={LinkComponent} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className={dropdown.itemsClassName ?? "grid w-full grid-cols-2 gap-3"}>
              {dropdown.groups[0]?.items.map((item) => (
                <li key={item.title}>
                  <MenuItemLink item={item} LinkComponent={LinkComponent} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

function MobileMenu({
  config,
  mobileAuthActions,
  LinkComponent,
  allLabel,
}: {
  config: AmbraPublicHeaderConfig;
  mobileAuthActions?: ReactNode;
  LinkComponent: ComponentType<LinkLikeProps>;
  allLabel: string;
}) {
  return (
    <div className="border-t bg-background md:hidden">
      <div className="container space-y-4 py-4">
        {config.dropdowns.map((dropdown) => (
          <MobileDropdown
            key={dropdown.id}
            title={dropdown.label}
            items={dropdown.groups.flatMap((group) => group.items)}
            LinkComponent={LinkComponent}
            allLabel={allLabel}
          />
        ))}

        {config.topLinks?.map((link) => (
          <Button key={link.href} variant="ghost" className="w-full justify-start" asChild>
            <LinkComponent href={link.href}>{link.label}</LinkComponent>
          </Button>
        ))}

        <div className="flex flex-col gap-2 pt-4">{mobileAuthActions}</div>
      </div>
    </div>
  );
}

function MobileDropdown({
  title,
  items,
  LinkComponent,
  allLabel,
}: {
  title: string;
  items: AmbraPublicHeaderMenuItem[];
  LinkComponent: ComponentType<LinkLikeProps>;
  allLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          {title}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full">
        <DropdownMenuItem asChild>
          <LinkComponent href="/" className="w-full">
            {allLabel} {title.toLowerCase()}
          </LinkComponent>
        </DropdownMenuItem>
        {items.map((item) => (
          <DropdownMenuItem key={item.title} asChild>
            <LinkComponent href={item.href} className="flex items-center gap-2">
              <item.icon className="h-4 w-4 text-primary" />
              <span>{item.title}</span>
            </LinkComponent>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AmbraPublicHeader({
  LinkComponent = DefaultLink,
  config,
  authActions,
  mobileAuthActions,
  closeMenuLabel = "Close menu",
  openMenuLabel = "Open menu",
  allLabel = "All",
}: AmbraPublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const desktopNav = mounted ? (
    <NavigationMenu>
      <NavigationMenuList>
        {config.dropdowns.map((dropdown) => (
          <HeaderDropdown key={dropdown.id} dropdown={dropdown} LinkComponent={LinkComponent} />
        ))}
        {config.topLinks?.map((link) => (
          <li key={link.href}>
            <LinkComponent
              href={link.href}
              className={cn(
                "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors duration-300 hover:text-primary",
                "text-foreground"
              )}
            >
              {link.label}
            </LinkComponent>
          </li>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  ) : (
    <nav className="flex items-center gap-1">
      {config.dropdowns.map((dropdown) => (
        <span
          key={dropdown.id}
          className={cn("flex items-center gap-1 px-4 py-2 text-sm font-medium text-foreground")}
        >
          {dropdown.label}
        </span>
      ))}
      {config.topLinks?.map((link) => (
        <LinkComponent
          key={link.href}
          href={link.href}
          className={cn(
            "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors duration-300 hover:text-primary",
            "text-foreground"
          )}
        >
          {link.label}
        </LinkComponent>
      ))}
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <LinkComponent
            href={config.homeHref ?? "/"}
            className="flex items-center gap-2.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            <BrandLockup size="md" hoverAnimation />
          </LinkComponent>
        </div>

        <div className="hidden items-center gap-6 md:flex">{desktopNav}</div>

        {authActions ? (
          <div className="hidden items-center gap-4 md:flex">{authActions}</div>
        ) : null}

        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? closeMenuLabel : openMenuLabel}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <MobileMenu
          config={config}
          mobileAuthActions={mobileAuthActions}
          LinkComponent={LinkComponent}
          allLabel={allLabel}
        />
      ) : null}
    </header>
  );
}
