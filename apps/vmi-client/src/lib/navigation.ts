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
    href: "/",
    label: "Pulpit",
    title: "Pulpit VMI",
    description: "Najważniejsze statusy zapasów, dostawców, propozycji i zamówień.",
    icon: Home
  },
  {
    href: "/vendors",
    label: "Dostawcy",
    title: "Dostawcy",
    description: "Relacje z dostawcami, kontakty, warunki i katalogi VMI.",
    icon: Layers
  },
  {
    href: "/inventory",
    label: "Zapas",
    title: "Zapas magazynowy",
    description: "Stany zapasów klienta według lokalizacji, dostawcy i pozycji katalogowej.",
    icon: Package
  },
  {
    href: "/stock-counts",
    label: "Spisy",
    title: "Inwentaryzacje VMI",
    description: "Zlecone i samodzielne spisy stanów, także z przyszłym trybem offline.",
    icon: RotateCcw
  },
  {
    href: "/proposals",
    label: "Propozycje",
    title: "Propozycje uzupełnień",
    description: "Sugestie dostawców do zatwierdzenia, korekty lub odrzucenia.",
    icon: FileText
  },
  {
    href: "/orders",
    label: "Zamówienia",
    title: "Zamówienia",
    description: "Zamówienia ręczne oraz utworzone z zaakceptowanych propozycji.",
    icon: ShoppingBag
  },
  {
    href: "/messages",
    label: "Wiadomości",
    title: "Wiadomości",
    description: "Komunikacja klienta z dostawcami w kontekście produktów i dokumentów.",
    icon: MessageSquare
  },
  {
    href: "/settings",
    label: "Ustawienia",
    title: "Ustawienia portalu",
    description: "Profil klienta, lokalizacje, preferencje i dostęp użytkowników.",
    icon: Settings
  }
] as const;

export type VmiRoute = (typeof vmiRoutes)[number];
export type VmiRouteHref = VmiRoute["href"];

export function getRouteByHref(href: VmiRouteHref): VmiRoute {
  return vmiRoutes.find((route) => route.href === href) ?? vmiRoutes[0];
}
