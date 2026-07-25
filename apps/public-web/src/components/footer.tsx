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
      { href: "/", label: "Funkcje" },
      { href: "/", label: "Cennik" },
      { href: "/", label: "Zaloguj się" },
      { href: "/", label: "Rozpocznij za darmo" },
    ],
  },
  {
    title: "Rozwiązania",
    links: [
      { href: "/", label: "Magazynowanie" },
      { href: "/", label: "Produkcja" },
      { href: "/", label: "Edukacja" },
      { href: "/", label: "Placówki medyczne" },
      { href: "/", label: "Serwis i naprawy" },
      { href: "/", label: "Budownictwo" },
    ],
  },
];

function LinkAdapter({ href, className, children }: LinkAdapterProps) {
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
