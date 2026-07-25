import {
  FileText,
  Home,
  Layers,
  MessageSquare,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag
} from "lucide-react";

export const vmiRoutes = [
  {
    href: "/portal",
    label: "Pulpit",
    mobileLabel: "Panel",
    title: "Pulpit VMI",
    description: "Najważniejsze statusy zapasów, dostawców, propozycji i zamówień.",
    icon: Home,
    showInDesktopNav: true,
    showInMobileNav: false
  },
  {
    href: "/portal/vendors",
    label: "Dostawcy",
    mobileLabel: "Dostawcy",
    title: "Dostawcy",
    description: "Relacje z dostawcami, kontakty, warunki i katalogi VMI.",
    icon: Layers,
    showInDesktopNav: true,
    showInMobileNav: false
  },
  {
    href: "/inventory",
    label: "Zapas magazynowy",
    mobileLabel: "Zapas",
    title: "Zapas magazynowy",
    description: "Stany zapasów klienta według lokalizacji, dostawcy i pozycji katalogowej.",
    icon: Package,
    showInDesktopNav: true,
    showInMobileNav: true
  },
  {
    href: "/orders",
    label: "Zamówienia",
    mobileLabel: "Zamówienia",
    title: "Zamówienia",
    description: "Zamówienia ręczne oraz utworzone z zaakceptowanych propozycji.",
    icon: ShoppingBag,
    showInDesktopNav: true,
    showInMobileNav: true
  },
  {
    href: "/proposals",
    label: "Oferty i zapytania",
    mobileLabel: "Oferty",
    title: "Oferty i zapytania",
    description: "Otrzymane wyceny handlowe, propozycje uzupełnień i zapytania RFQ.",
    icon: FileText,
    showInDesktopNav: true,
    showInMobileNav: true
  },
  {
    href: "/messages",
    label: "Wiadomości",
    mobileLabel: "Czat",
    title: "Wiadomości",
    description: "Komunikacja klienta z dostawcami w kontekście produktów i dokumentów.",
    icon: MessageSquare,
    showInDesktopNav: true,
    showInMobileNav: true
  },
  {
    href: "/settings",
    label: "Ustawienia i Sandbox",
    mobileLabel: "Opcje",
    title: "Ustawienia i Sandbox",
    description: "Profil klienta, symulacja sieci, powiadomienia i cache demo.",
    icon: Settings,
    showInDesktopNav: true,
    showInMobileNav: true
  },
  {
    href: "/stock-counts",
    label: "Inwentaryzacja VMI",
    mobileLabel: "Spis",
    title: "Inwentaryzacje VMI",
    description: "Zlecone i samodzielne spisy stanów, także z trybem offline.",
    icon: RotateCcw,
    showInDesktopNav: false,
    showInMobileNav: false
  }
] as const;

export type VmiRoute = (typeof vmiRoutes)[number];
export type VmiRouteHref = VmiRoute["href"];

export const vmiDesktopNavRoutes = vmiRoutes.filter((route) => route.showInDesktopNav);
export const vmiMobileNavRoutes = vmiRoutes.filter((route) => route.showInMobileNav);

export function getRouteByHref(href: VmiRouteHref): VmiRoute {
  return vmiRoutes.find((route) => route.href === href) ?? vmiRoutes[0];
}
