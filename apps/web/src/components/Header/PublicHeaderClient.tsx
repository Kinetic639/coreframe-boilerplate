"use client";

import type { ReactNode } from "react";
import { AMBRA_PUBLIC_HEADER_CONFIG, AmbraPublicHeader } from "@repo/ui/ambra-public-header";
import { Link } from "@/i18n/navigation";
import { getMarketingSiteUrl } from "@/lib/urls";

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

const APP_PUBLIC_HEADER_CONFIG = {
  ...AMBRA_PUBLIC_HEADER_CONFIG,
  homeHref: getMarketingSiteUrl(),
};

export function PublicHeaderClient({
  showPricing = true,
  authActions,
}: {
  showPricing?: boolean;
  authActions?: ReactNode;
}) {
  const config = showPricing
    ? APP_PUBLIC_HEADER_CONFIG
    : { ...APP_PUBLIC_HEADER_CONFIG, topLinks: [] };

  return (
    <AmbraPublicHeader
      LinkComponent={LinkAdapter}
      config={config}
      authActions={authActions}
      mobileAuthActions={authActions}
    />
  );
}
