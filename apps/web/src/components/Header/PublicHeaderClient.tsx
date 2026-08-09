"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AmbraPublicHeader,
  buildAmbraPublicHeaderConfig,
  type AmbraPublicHeaderConfig,
} from "@repo/ui/ambra-public-header";
import { Link } from "@/i18n/navigation";
import { getMarketingSiteUrl } from "@/lib/urls";
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

// This header only ever renders on apps/web's *public*, unauthenticated pages
// (see apps/web/src/app/[locale]/(public)/layout.tsx -- it's never shown
// inside the authenticated dashboard). Since a visitor here is in the exact
// same "not signed in yet" context as a visitor on apps/public-web, the header
// content matches it exactly, including the VMI marketplace dropdown. The
// marketplace/vendor/product pages themselves only exist in apps/public-web,
// so those links point there via getMarketingSiteUrl() instead of a local path.
function useHeaderConfig(showPricing: boolean): AmbraPublicHeaderConfig {
  const t = useTranslations("PublicHeader");
  const marketingSiteUrl = getMarketingSiteUrl();
  const base = buildAmbraPublicHeaderConfig({ t, homeHref: marketingSiteUrl, showPricing });

  return {
    ...base,
    dropdowns: [
      ...base.dropdowns,
      {
        id: "vmi-marketplace",
        label: t("dropdowns.vmi.label"),
        description: t("dropdowns.vmi.description"),
        groups: [
          {
            category: t("dropdowns.vmi.marketplaceCategory"),
            items: [
              {
                icon: Store,
                title: t("dropdowns.vmi.items.marketplace.title"),
                description: t("dropdowns.vmi.items.marketplace.description"),
                href: `${marketingSiteUrl}/vmi`,
              },
              {
                icon: MapPinned,
                title: t("dropdowns.vmi.items.vendors.title"),
                description: t("dropdowns.vmi.items.vendors.description"),
                href: `${marketingSiteUrl}/vmi/vendors`,
              },
              {
                icon: PackageSearch,
                title: t("dropdowns.vmi.items.products.title"),
                description: t("dropdowns.vmi.items.products.description"),
                href: `${marketingSiteUrl}/vmi/products`,
              },
              {
                icon: Radar,
                title: t("dropdowns.vmi.items.vendorMap.title"),
                description: t("dropdowns.vmi.items.vendorMap.description"),
                href: `${marketingSiteUrl}/vmi/vendors?view=map`,
              },
            ],
          },
          {
            category: t("dropdowns.vmi.portalCategory"),
            items: [
              {
                icon: Handshake,
                title: t("dropdowns.vmi.items.vmiSignIn.title"),
                description: t("dropdowns.vmi.items.vmiSignIn.description"),
                href: "https://vmi.ambra-system.com/sign-in",
              },
              {
                icon: Boxes,
                title: t("dropdowns.vmi.items.vmiPortal.title"),
                description: t("dropdowns.vmi.items.vmiPortal.description"),
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
  };
}

export function PublicHeaderClient({
  showPricing = true,
  authActions,
}: {
  showPricing?: boolean;
  authActions?: ReactNode;
}) {
  const t = useTranslations("PublicHeader");
  const config = useHeaderConfig(showPricing);

  return (
    <AmbraPublicHeader
      LinkComponent={LinkAdapter}
      config={config}
      authActions={authActions}
      mobileAuthActions={authActions}
      openMenuLabel={t("openMenu")}
      closeMenuLabel={t("closeMenu")}
      allLabel={t("allPrefix")}
    />
  );
}
