"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AmbraPublicHeader,
  buildAmbraPublicHeaderConfig,
  type AmbraPublicHeaderConfig,
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

// public-web is the only app with a public VMI marketplace, so it extends the
// shared Features/Solutions/Educational base (see @repo/ui/ambra-public-header)
// with its own extra dropdown -- everything else about the header stays the
// single shared source of truth.
function useHeaderConfig(showPricing: boolean): AmbraPublicHeaderConfig {
  const t = useTranslations("PublicHeader");
  const base = buildAmbraPublicHeaderConfig({ t, homeHref: "/", showPricing });

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
                href: "/vmi",
              },
              {
                icon: MapPinned,
                title: t("dropdowns.vmi.items.vendors.title"),
                description: t("dropdowns.vmi.items.vendors.description"),
                href: "/vmi/vendors",
              },
              {
                icon: PackageSearch,
                title: t("dropdowns.vmi.items.products.title"),
                description: t("dropdowns.vmi.items.products.description"),
                href: "/vmi/products",
              },
              {
                icon: Radar,
                title: t("dropdowns.vmi.items.vendorMap.title"),
                description: t("dropdowns.vmi.items.vendorMap.description"),
                href: "/vmi/vendors?view=map",
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
