"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
  return (
    <Link href={href as Parameters<typeof Link>[0]["href"]} className={className}>
      {children}
    </Link>
  );
}

const Footer = () => {
  const t = useTranslations("PublicFooter");

  const footerColumns = [
    {
      title: t("columns.product.title"),
      links: [
        { href: "/", label: t("columns.product.features") },
        { href: "/", label: t("columns.product.pricing") },
        { href: "/", label: t("columns.product.signIn") },
        { href: "/", label: t("columns.product.getStarted") },
      ],
    },
    {
      title: t("columns.solutions.title"),
      links: [
        { href: "/", label: t("columns.solutions.warehousing") },
        { href: "/", label: t("columns.solutions.manufacturing") },
        { href: "/", label: t("columns.solutions.education") },
        { href: "/", label: t("columns.solutions.healthcare") },
        { href: "/", label: t("columns.solutions.serviceRepair") },
        { href: "/", label: t("columns.solutions.construction") },
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
