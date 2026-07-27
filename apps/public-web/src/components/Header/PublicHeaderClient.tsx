"use client";

import type { ReactNode } from "react";
import {
  AMBRA_PUBLIC_HEADER_CONFIG,
  type AmbraPublicHeaderConfig,
  AmbraPublicHeader,
} from "@repo/ui/ambra-public-header";
import { Link } from "@/i18n/navigation";
import { Boxes, Handshake, MapPinned, PackageSearch, Radar, Store } from "lucide-react";

interface LinkAdapterProps {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

function LinkAdapter({ href, className, children, onClick }: LinkAdapterProps) {
  if (href.startsWith("http")) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href as Parameters<typeof Link>[0]["href"]} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

const PUBLIC_WEB_HEADER_CONFIG: AmbraPublicHeaderConfig = {
  ...AMBRA_PUBLIC_HEADER_CONFIG,
  dropdowns: [
    ...AMBRA_PUBLIC_HEADER_CONFIG.dropdowns,
    {
      id: "vmi-marketplace",
      label: "VMI",
      description:
        "Publiczny marketplace VMI: dostawcy, produkty, gazetki i przejście do portalu klienta.",
      groups: [
        {
          category: "Marketplace",
          items: [
            {
              icon: Store,
              title: "Marketplace VMI",
              description: "Start publicznego katalogu dostawców i produktów",
              href: "/vmi",
            },
            {
              icon: MapPinned,
              title: "Dostawcy",
              description: "Wyszukiwanie po lokalizacji, kategorii i gotowości VMI",
              href: "/vmi/vendors",
            },
            {
              icon: PackageSearch,
              title: "Produkty",
              description: "Publiczny katalog produktów i marek dostawców",
              href: "/vmi/products",
            },
            {
              icon: Radar,
              title: "Mapa dostawców",
              description: "Widok dostawców według regionu i zasięgu obsługi",
              href: "/vmi/vendors?view=map",
            },
          ],
        },
        {
          category: "Portal",
          items: [
            {
              icon: Handshake,
              title: "Zaloguj do VMI",
              description: "Przejdź do portalu klienta VMI",
              href: "https://vmi.ambra-system.com/sign-in",
            },
            {
              icon: Boxes,
              title: "Panel VMI",
              description: "Zapasy, zamówienia, propozycje i komunikacja",
              href: "https://vmi.ambra-system.com/portal",
            },
          ],
        },
      ],
      contentClassName: "grid w-[800px] grid-cols-[180px_1fr] gap-8 p-6",
      groupsClassName: "grid grid-cols-2 gap-x-6 gap-y-10",
      itemsClassName: "space-y-3",
    },
  ],
  topLinks: [
    ...(AMBRA_PUBLIC_HEADER_CONFIG.topLinks ?? []),
    { label: "VMI", href: "/vmi" },
    { label: "Dostawcy", href: "/vmi/vendors" },
  ],
};

export function PublicHeaderClient({
  showPricing = true,
  authActions,
}: {
  showPricing?: boolean;
  authActions?: ReactNode;
}) {
  const config = showPricing ? PUBLIC_WEB_HEADER_CONFIG : { ...PUBLIC_WEB_HEADER_CONFIG, topLinks: [] };

  return (
    <AmbraPublicHeader
      LinkComponent={LinkAdapter}
      config={config}
      authActions={authActions}
      mobileAuthActions={authActions}
    />
  );
}
