"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { AmbraPublicHeaderConfig } from "@repo/ui/ambra-public-header";
import { AmbraPublicHeader } from "@repo/ui/ambra-public-header";
import { Button } from "@repo/ui/button";
import {
  Boxes,
  Building2,
  ClipboardCheck,
  Handshake,
  MapPinned,
  PackageSearch,
  Radar,
  Route,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react";

interface PublicMarketplaceShellProps {
  children: ReactNode;
}

interface LinkAdapterProps {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

function LinkAdapter({ href, className, children, onClick }: LinkAdapterProps) {
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

const authActions = (
  <>
    <Button variant="outline" asChild>
      <Link href="/sign-in">Zaloguj się</Link>
    </Button>
    <Button asChild>
      <Link href="/sign-up">Zarejestruj się</Link>
    </Button>
  </>
);

const vmiHeaderConfig: AmbraPublicHeaderConfig = {
  homeHref: "/",
  dropdowns: [
    {
      id: "discovery",
      label: "Dostawcy",
      description:
        "Znajdź dostawców według lokalizacji, branży, kategorii produktów i gotowości do obsługi VMI.",
      groups: [
        {
          items: [
            {
              icon: MapPinned,
              title: "Mapa dostawców",
              description: "Wyszukiwanie po regionie, promieniu dostaw i odległości logistycznej",
              href: "/vendors",
            },
            {
              icon: PackageSearch,
              title: "Kategorie produktów",
              description: "Przeglądaj dostawców według asortymentu i specjalizacji",
              href: "/products",
            },
            {
              icon: Radar,
              title: "Dostawcy VMI",
              description: "Partnerzy gotowi monitorować zapasy i automatyzować uzupełnienia",
              href: "/vendors?capability=vmi",
            },
            {
              icon: Store,
              title: "Profile dostawców",
              description: "Dane firmy, oferta, zasięg i warunki współpracy",
              href: "/vendors",
            },
          ],
        },
      ],
      contentClassName: "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6",
      itemsClassName: "grid w-full grid-cols-2 gap-3",
    },
    {
      id: "vmi",
      label: "VMI",
      description:
        "Obsługa stałej współpracy z dostawcami: zapasy, zamówienia, audyty i automatyczne propozycje.",
      groups: [
        {
          category: "Proces",
          items: [
            {
              icon: Handshake,
              title: "Onboarding partnera",
              description: "Rozpoczęcie kontaktu, warunki SLA i zaproszenie do współpracy",
              href: "/partnerships",
            },
            {
              icon: Boxes,
              title: "Stany magazynowe",
              description: "Widoczność zapasów klienta dla zatwierdzonych dostawców",
              href: "/inventory",
            },
            {
              icon: ShoppingCart,
              title: "Zamówienia",
              description: "Propozycje uzupełnień i zatwierdzanie zakupów",
              href: "/orders",
            },
          ],
        },
        {
          category: "Operacje",
          items: [
            {
              icon: ClipboardCheck,
              title: "Stock count",
              description: "Liczenie zapasów i przekazywanie wyników dostawcy",
              href: "/stock-counts",
            },
            {
              icon: Route,
              title: "Zasięg dostaw",
              description: "Dostawy według lokalizacji, oddziałów i tras logistycznych",
              href: "/vendors?view=map",
            },
            {
              icon: ShieldCheck,
              title: "Warunki współpracy",
              description: "Uprawnienia, zakres danych i zasady relacji B2B",
              href: "/settings",
            },
          ],
        },
      ],
      contentClassName: "grid w-[800px] grid-cols-[180px_1fr] gap-8 p-6",
      groupsClassName: "grid grid-cols-2 gap-x-6 gap-y-10",
      itemsClassName: "space-y-3",
    },
    {
      id: "resources",
      label: "Materiały",
      description:
        "Praktyczne informacje dla klientów wdrażających automatyczne uzupełnianie zapasów.",
      groups: [
        {
          category: "Centrum wiedzy",
          items: [
            {
              icon: Building2,
              title: "Dla kupujących",
              description: "Jak wybrać dostawcę i rozpocząć współpracę VMI",
              href: "/buyers",
            },
            {
              icon: Truck,
              title: "Dla dostawców",
              description: "Jak dostawcy mogą obsługiwać klientów przez Ambra",
              href: "/suppliers",
            },
          ],
        },
      ],
      contentClassName: "grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6",
      groupsClassName: "grid grid-cols-2 gap-x-6 gap-y-4",
      groupClassName: "col-span-2 space-y-3",
      itemsClassName: "grid grid-cols-2 gap-3",
    },
  ],
  topLinks: [{ label: "Produkty", href: "/products" }],
};

export function PublicMarketplaceShell({ children }: PublicMarketplaceShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AmbraPublicHeader
        LinkComponent={LinkAdapter}
        config={vmiHeaderConfig}
        authActions={authActions}
        mobileAuthActions={authActions}
      />
      <main>{children}</main>
    </div>
  );
}
