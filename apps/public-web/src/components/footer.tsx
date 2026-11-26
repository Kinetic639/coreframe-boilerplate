"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { appUrl, buildSignInUrl, buildSignUpUrl } from "@repo/app-urls";
import { PublicFooter } from "@repo/ui/public-footer";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import { ThemeSwitcher } from "./theme-switcher";

interface LinkAdapterProps {
  href: string;
  className?: string;
  children: ReactNode;
}

function LinkAdapter({ href, className, children }: LinkAdapterProps) {
  if (href.startsWith("http")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href as Parameters<typeof Link>[0]["href"]} className={className}>
      {children}
    </Link>
  );
}

const Footer = () => {
  const t = useTranslations("PublicFooter");
  const locale = useLocale() === "en" ? "en" : "pl";

  const footerColumns = [
    {
      title: t("columns.product.title"),
      links: [
        { href: "/features", label: t("columns.product.features") },
        { href: "/pricing", label: t("columns.product.pricing") },
        { href: buildSignInUrl(null, locale), label: t("columns.product.ambraErp") },
        { href: buildSignUpUrl(locale), label: t("columns.product.ambraErpSignUp") },
      ],
    },
    {
      title: t("columns.vmiMarketplace.title"),
      links: [
        { href: "/vmi", label: t("columns.vmiMarketplace.marketplace") },
        { href: "/vmi/vendors", label: t("columns.vmiMarketplace.vendors") },
        { href: "/vmi/products", label: t("columns.vmiMarketplace.products") },
        { href: "/vmi/vendors?view=map", label: t("columns.vmiMarketplace.vendorMap") },
        { href: appUrl("vmi", "/sign-in"), label: t("columns.vmiMarketplace.vmiSignIn") },
        { href: appUrl("vmi", "/portal"), label: t("columns.vmiMarketplace.vmiPortal") },
      ],
    },
  ];

  return (
    <PublicFooter
      LinkComponent={LinkAdapter}
      description={t("description")}
      rightsReservedText={t("rightsReserved")}
      columns={footerColumns}
      legalLinks={[
        { href: "/", label: t("legal.privacyPolicy") },
        { href: "/", label: t("legal.terms") },
      ]}
      copyrightName="@Kinetic639"
      copyrightHref="https://github.com/Kinetic639"
      themeSwitcher={<ThemeSwitcher />}
      localeSwitcher={<LocaleSwitcher />}
    />
  );
};

export default Footer;
