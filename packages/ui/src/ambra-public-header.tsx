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
  config?: AmbraPublicHeaderConfig;
  authActions?: ReactNode;
  mobileAuthActions?: ReactNode;
}

const features: AmbraPublicHeaderMenuItem[] = [
  {
    icon: Smartphone,
    title: "Aplikacja mobilna",
    description: "Śledź inwentarz z dowolnego miejsca",
    href: "/features#mobile",
  },
  {
    icon: QrCode,
    title: "Kodowanie QR",
    description: "Skanowanie i etykietowanie kodów QR",
    href: "/features#qr",
  },
  {
    icon: Bell,
    title: "Alerty",
    description: "Alerty o niskim stanie, przeterminowaniu",
    href: "/features#alerts",
  },
  {
    icon: Barcode,
    title: "Kodowanie kreskowe",
    description: "Etykietowanie i skanowanie kodów",
    href: "/features#barcode",
  },
  {
    icon: GearIcon,
    title: "Integracje",
    description: "Połączenie z innymi systemami",
    href: "/features#integrations",
  },
  {
    icon: BarChart,
    title: "Raportowanie",
    description: "Statystyki i analizy danych",
    href: "/features#reporting",
  },
];

const solutionsMenuItems: AmbraPublicHeaderMenuGroup[] = [
  {
    category: "Zastosowania",
    items: [
      {
        icon: Archive,
        title: "Zarządzanie magazynem",
        description: "Zarządzaj, organizuj i monitoruj cały inwentarz swojej firmy",
        href: "/solutions/magazynowanie",
      },
      {
        icon: Truck,
        title: "Śledzenie dostaw",
        description: "Śledź materiały, surowce i części wykorzystywane w Twojej firmie",
        href: "/solutions/dostawy",
      },
      {
        icon: Hammer,
        title: "Śledzenie aktywów",
        description: "Śledź narzędzia, sprzęt i inne wartościowe aktywa z łatwością",
        href: "/solutions/aktywa",
      },
    ],
  },
  {
    category: "Branże",
    items: [
      {
        icon: Building,
        title: "Budownictwo",
        description: "Zarządzaj inwentarzem budowlanym i narzędziami na wszystkich placach budowy",
        href: "/solutions/budownictwo",
      },
      {
        icon: Hospital,
        title: "Placówki medyczne",
        description: "Bezproblemowo zarządzaj materiałami medycznymi i sprzętem w podróży",
        href: "/solutions/medycyna",
      },
      {
        icon: Factory,
        title: "Produkcja",
        description:
          "Uproszczenie operacji magazynowych dzięki inteligentniejszemu śledzeniu zapasów",
        href: "/solutions/produkcja",
      },
      {
        icon: GraduationCap,
        title: "Edukacja",
        description: "Łatwo zarządzaj inwentarzem szkolnym i materiałami",
        href: "/solutions/edukacja",
      },
      {
        icon: Wrench,
        title: "Serwis i naprawy",
        description:
          "Zwiększ efektywność organizacji non-profit dzięki kontroli zapasów w czasie rzeczywistym",
        href: "/solutions/serwis",
      },
    ],
  },
];

const educationalMenuItems: AmbraPublicHeaderMenuGroup[] = [
  {
    category: "Materiały",
    items: [
      {
        icon: FileText,
        title: "Blog",
        description: "Artykuły i porady dotyczące zarządzania magazynem",
        href: "/blog",
      },
      {
        icon: BookOpen,
        title: "Baza wiedzy",
        description: "Kompleksowe poradniki i instrukcje",
        href: "/knowledge-base",
      },
      {
        icon: RefreshCw,
        title: "Aktualizacje",
        description: "Najnowsze aktualizacje i funkcje produktu",
        href: "/updates",
      },
      {
        icon: KanbanSquare,
        title: "Roadmapa",
        description: "Zobacz co planujemy na przyszłość",
        href: "/roadmap",
      },
    ],
  },
];

export const AMBRA_PUBLIC_HEADER_CONFIG: AmbraPublicHeaderConfig = {
  homeHref: "/",
  dropdowns: [
    {
      id: "features",
      label: "Funkcje",
      description:
        "Odkryj, jak MagazynPro upraszcza zarządzanie inwentarzem dzięki funkcjom zaprojektowanym dla łatwości i organizacji.",
      groups: [{ items: features }],
      contentClassName: "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6",
      itemsClassName: "grid w-full grid-cols-2 gap-3",
    },
    {
      id: "solutions",
      label: "Rozwiązania",
      description:
        "Bez względu na to, czego potrzebujesz do śledzenia, MagazynPro ma dla Ciebie rozwiązanie.",
      groups: solutionsMenuItems,
      contentClassName: "grid w-[800px] grid-cols-[180px_1fr] gap-8 p-6",
      groupsClassName: "grid grid-cols-2 gap-x-6 gap-y-10",
      itemsClassName: "space-y-3",
    },
    {
      id: "educational",
      label: "Materiały edukacyjne",
      description: "Odkryj nasze materiały edukacyjne, które pomogą Ci lepiej zarządzać magazynem.",
      groups: educationalMenuItems,
      contentClassName: "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6",
      groupsClassName: "grid grid-cols-2 gap-x-6 gap-y-4",
      itemsClassName: "grid grid-cols-2 gap-3",
    },
  ],
  topLinks: [{ label: "Cennik", href: "/pricing" }],
};

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
  activeDropdown,
  setActiveDropdown,
  LinkComponent,
}: {
  dropdown: AmbraPublicHeaderDropdown;
  activeDropdown: string | null;
  setActiveDropdown: (v: string | null) => void;
  LinkComponent: ComponentType<LinkLikeProps>;
}) {
  const grouped = dropdown.groups.length > 1 || dropdown.groups.some((group) => group.category);

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        onClick={() => setActiveDropdown(activeDropdown === dropdown.id ? null : dropdown.id)}
      >
        {dropdown.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent className="transition-all duration-300 ease-in-out">
        <div
          className={dropdown.contentClassName ?? "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6"}
        >
          <div>
            <div
              onClick={() => setActiveDropdown(null)}
              className="group mb-4 flex cursor-pointer items-center text-lg font-semibold tracking-tight transition-all duration-300 hover:text-primary"
            >
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
}: {
  config: AmbraPublicHeaderConfig;
  mobileAuthActions?: ReactNode;
  LinkComponent: ComponentType<LinkLikeProps>;
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
}: {
  title: string;
  items: AmbraPublicHeaderMenuItem[];
  LinkComponent: ComponentType<LinkLikeProps>;
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
            Wszystkie {title.toLowerCase()}
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
  config = AMBRA_PUBLIC_HEADER_CONFIG,
  authActions,
  mobileAuthActions,
}: AmbraPublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const desktopNav = mounted ? (
    <NavigationMenu>
      <NavigationMenuList>
        {config.dropdowns.map((dropdown) => (
          <HeaderDropdown
            key={dropdown.id}
            dropdown={dropdown}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            LinkComponent={LinkComponent}
          />
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
            aria-label={mobileMenuOpen ? "Zamknij menu" : "Otwórz menu"}
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
        />
      ) : null}
    </header>
  );
}
