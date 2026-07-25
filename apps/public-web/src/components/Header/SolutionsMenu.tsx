// SolutionsMenu.tsx
"use client";
import React from "react";
import {
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Link } from "@/i18n/navigation";
import {
  Archive,
  Truck,
  Hammer,
  Building,
  Hospital,
  Factory,
  GraduationCap,
  Wrench,
} from "lucide-react";

const solutionsMenuItems = [
  {
    category: "Zastosowania",
    items: [
      {
        icon: Archive,
        title: "Zarządzanie magazynem",
        description: "Zarządzaj, organizuj i monitoruj cały inwentarz swojej firmy",
        href: "/solutions/magazynowanie",
      },
      {
        icon: Truck,
        title: "Śledzenie dostaw",
        description: "Śledź materiały, surowce i części wykorzystywane w Twojej firmie",
        href: "/solutions/dostawy",
      },
      {
        icon: Hammer,
        title: "Śledzenie aktywów",
        description: "Śledź narzędzia, sprzęt i inne wartościowe aktywa z łatwością",
        href: "/solutions/aktywa",
      },
    ],
  },
  {
    category: "Branże",
    items: [
      {
        icon: Building,
        title: "Budownictwo",
        description: "Zarządzaj inwentarzem budowlanym i narzędziami na wszystkich placach budowy",
        href: "/solutions/budownictwo",
      },
      {
        icon: Hospital,
        title: "Placówki medyczne",
        description: "Bezproblemowo zarządzaj materiałami medycznymi i sprzętem w podróży",
        href: "/solutions/medycyna",
      },
      {
        icon: Factory,
        title: "Produkcja",
        description:
          "Uproszczenie operacji magazynowych dzięki inteligentniejszemu śledzeniu zapasów",
        href: "/solutions/produkcja",
      },
      {
        icon: GraduationCap,
        title: "Edukacja",
        description: "Łatwo zarządzaj inwentarzem szkolnym i materiałami",
        href: "/solutions/edukacja",
      },
      {
        icon: Wrench,
        title: "Serwis i naprawy",
        description:
          "Zwiększ efektywność organizacji non-profit dzięki kontroli zapasów w czasie rzeczywistym",
        href: "/solutions/serwis",
      },
    ],
  },
];

const SolutionsMenu = ({
  activeDropdown,
  setActiveDropdown,
}: {
  activeDropdown: string | null;
  setActiveDropdown: (v: string | null) => void;
}) => {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        onClick={() => setActiveDropdown(activeDropdown === "solutions" ? null : "solutions")}
      >
        Rozwiązania
      </NavigationMenuTrigger>
      <NavigationMenuContent className="transition-all duration-300 ease-in-out">
        <div className="grid w-[800px] grid-cols-[180px_1fr] gap-8 p-6">
          <div>
            <div
              onClick={() => setActiveDropdown(null)}
              className="group mb-4 flex cursor-pointer items-center text-lg font-semibold tracking-tight transition-all duration-300 hover:text-primary"
            >
              Rozwiązania
              <span className="ml-1 inline-block transform opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                →
              </span>
            </div>
            <p className="pr-4 text-sm text-muted-foreground">
              Bez względu na to, czego potrzebujesz do śledzenia, MagazynPro ma dla Ciebie
              rozwiązanie.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10">
            {solutionsMenuItems.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-3">
                <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {group.category}
                </h4>
                <ul className="space-y-3">
                  {group.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={"/"}
                          className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-all duration-300 hover:bg-accent hover:text-primary focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="flex items-center gap-2">
                            <div className="rounded-md bg-primary/10 p-1 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                              <item.icon className="h-5 w-5" />
                            </div>
                            <div className="text-sm font-medium leading-none transition-all duration-300 group-hover:text-primary">
                              {item.title}
                            </div>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground transition-all duration-300 group-hover:text-muted-foreground/80">
                            {item.description}
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

export default SolutionsMenu;
