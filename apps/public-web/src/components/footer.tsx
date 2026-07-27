import type { ReactNode } from "react";
import { PublicFooter } from "@repo/ui/public-footer";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import { ThemeSwitcher } from "./theme-switcher";

interface LinkAdapterProps {
  href: string;
  className?: string;
  children: ReactNode;
}

const footerColumns = [
  {
    title: "Produkt",
    links: [
      { href: "/features", label: "Funkcje" },
      { href: "/pricing", label: "Cennik" },
      { href: "https://app.ambra-system.com/sign-in", label: "Ambra ERP" },
      { href: "https://app.ambra-system.com/sign-up", label: "Rejestracja ERP" },
    ],
  },
  {
    title: "VMI marketplace",
    links: [
      { href: "/vmi", label: "Marketplace VMI" },
      { href: "/vmi/vendors", label: "Dostawcy" },
      { href: "/vmi/products", label: "Produkty" },
      { href: "/vmi/vendors?view=map", label: "Mapa dostawców" },
      { href: "https://vmi.ambra-system.com/sign-in", label: "Logowanie VMI" },
      { href: "https://vmi.ambra-system.com/portal", label: "Panel VMI" },
    ],
  },
];

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

const footer = () => {
  return (
    <PublicFooter
      LinkComponent={LinkAdapter}
      description="Nowoczesne narzędzie do zarządzania magazynem i inwentarzem dla firm każdej wielkości."
      columns={footerColumns}
      copyrightName="@Kinetic639"
      copyrightHref="https://github.com/Kinetic639"
      themeSwitcher={<ThemeSwitcher />}
      localeSwitcher={<LocaleSwitcher />}
    />
  );
};

export default footer;
