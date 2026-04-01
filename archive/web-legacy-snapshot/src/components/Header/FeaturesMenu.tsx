// FeaturesMenu.tsx
"use client";
import React from "react";
import {
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Link } from "@/i18n/navigation";
import { Smartphone, QrCode, Bell, Barcode, Settings as GearIcon, BarChart } from "lucide-react";

const features = [
  {
    icon: Smartphone,
    title: "Aplikacja mobilna",
    description: "Śledź inwentarz z dowolnego miejsca",
    href: "/features#mobile",
  },
  {
    icon: QrCode,
    title: "Kodowanie QR",
    description: "Skanowanie i etykietowanie kodów QR",
    href: "/features#qr",
  },
  {
    icon: Bell,
    title: "Alerty",
    description: "Alerty o niskim stanie, przeterminowaniu",
    href: "/features#alerts",
  },
  {
    icon: Barcode,
    title: "Kodowanie kreskowe",
    description: "Etykietowanie i skanowanie kodów",
    href: "/features#barcode",
  },
  {
    icon: GearIcon,
    title: "Integracje",
    description: "Połączenie z innymi systemami",
    href: "/features#integrations",
  },
  {
    icon: BarChart,
    title: "Raportowanie",
    description: "Statystyki i analizy danych",
    href: "/features#reporting",
  },
];

const FeaturesMenu = ({
  activeDropdown,
  setActiveDropdown,
}: {
  activeDropdown: string | null;
  setActiveDropdown: (v: string | null) => void;
}) => {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        onClick={() => setActiveDropdown(activeDropdown === "features" ? null : "features")}
      >
        Funkcje
      </NavigationMenuTrigger>
      <NavigationMenuContent className="transition-all duration-300 ease-in-out">
        <div className="grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6">
          <div>
            <div
              onClick={() => setActiveDropdown(null)}
              className="group mb-4 flex cursor-pointer items-center text-lg font-semibold tracking-tight transition-all duration-300 hover:text-primary"
            >
              Funkcje
              <span className="ml-1 inline-block transform opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                →
              </span>
            </div>
            <p className="pr-4 text-sm text-muted-foreground">
              Odkryj, jak MagazynPro upraszcza zarządzanie inwentarzem dzięki funkcjom
              zaprojektowanym dla łatwości i organizacji.
            </p>
          </div>
          <ul className="grid w-full grid-cols-2 gap-3">
            {features.map((feature) => (
              <li key={feature.title}>
                <NavigationMenuLink asChild>
                  <Link
                    href={"/"}
                    className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-all duration-300 hover:bg-accent hover:text-primary focus:bg-accent focus:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-primary/10 p-1 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                        <feature.icon className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-medium leading-none transition-all duration-300 group-hover:text-primary">
                        {feature.title}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-snug text-muted-foreground transition-all duration-300 group-hover:text-muted-foreground/80">
                      {feature.description}
                    </p>
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

export default FeaturesMenu;
