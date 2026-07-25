// EducationalMenu.tsx
"use client";
import React from "react";
import {
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Link } from "@/i18n/navigation";
import { FileText, BookOpen, RefreshCw, KanbanSquare } from "lucide-react";

const educationalMenuItems = [
  {
    category: "Materiały",
    items: [
      {
        icon: FileText,
        title: "Blog",
        description: "Artykuły i porady dotyczące zarządzania magazynem",
        href: "/blog",
      },
      {
        icon: BookOpen,
        title: "Baza wiedzy",
        description: "Kompleksowe poradniki i instrukcje",
        href: "/knowledge-base",
      },
      {
        icon: RefreshCw,
        title: "Aktualizacje",
        description: "Najnowsze aktualizacje i funkcje produktu",
        href: "/updates",
      },
      {
        icon: KanbanSquare,
        title: "Roadmapa",
        description: "Zobacz co planujemy na przyszłość",
        href: "/roadmap",
      },
    ],
  },
];

const EducationalMenu = ({
  activeDropdown,
  setActiveDropdown,
}: {
  activeDropdown: string | null;
  setActiveDropdown: (v: string | null) => void;
}) => {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        onClick={() => setActiveDropdown(activeDropdown === "educational" ? null : "educational")}
      >
        Materiały edukacyjne
      </NavigationMenuTrigger>
      <NavigationMenuContent className="transition-all duration-300 ease-in-out">
        <div className="grid w-[600px] grid-cols-[180px_1fr] gap-8 p-6">
          <div>
            <div
              onClick={() => setActiveDropdown(null)}
              className="group mb-4 flex cursor-pointer items-center text-lg font-semibold tracking-tight transition-all duration-300 hover:text-primary"
            >
              Materiały edukacyjne
              <span className="ml-1 inline-block transform opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                →
              </span>
            </div>
            <p className="pr-4 text-sm text-muted-foreground">
              Odkryj nasze materiały edukacyjne, które pomogą Ci lepiej zarządzać magazynem.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {educationalMenuItems.map((group, groupIndex) => (
              <div key={groupIndex} className="col-span-2 space-y-3">
                <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {group.category}
                </h4>
                <ul className="grid grid-cols-2 gap-3">
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

export default EducationalMenu;
