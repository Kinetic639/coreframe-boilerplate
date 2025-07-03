"use client";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { motion } from "framer-motion";
import { educationalMenuItems, features, solutionsMenuItems } from "./menuData";
import { Link } from "@/i18n/navigation";

interface MenuItem {
  title: string;
  href: string;
  description: string;
  icon: React.ElementType;
  items?: MenuItem[];
}

export default function DesktopMenu() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {[
          {
            title: "Funkcje",
            items: features,
            description: "Jak MagazynPro ułatwia pracę",
            href: "/features",
          },
          {
            title: "Rozwiązania",
            items: solutionsMenuItems,
            description: "Rozwiązania dla Twojej branży",
            href: "/solutions",
          },
          {
            title: "Materiały edukacyjne",
            items: educationalMenuItems,
            description: "Poradniki i baza wiedzy",
            href: "/blog",
          },
        ].map((menu) => (
          <NavigationMenuItem key={menu.title}>
            <NavigationMenuTrigger>{menu.title}</NavigationMenuTrigger>
            <NavigationMenuContent>
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="grid w-[700px] grid-cols-[180px_1fr] gap-8 p-6"
              >
                <div>
                  <Link href={menu.href} className="text-lg font-semibold hover:text-primary">
                    {menu.title} →
                  </Link>
                  <p className="text-sm text-muted-foreground">{menu.description}</p>
                </div>
                <ul className="grid grid-cols-2 gap-3">
                  {menu.items.flatMap((group: MenuItem) =>
                    (group.items || [group]).map((item: MenuItem) => (
                      <li key={item.title}>
                        <NavigationMenuLink asChild>
                          <Link href={item.href} className="block rounded p-2 hover:bg-accent">
                            <div className="flex items-center gap-2">
                              <item.icon className="h-5 w-5 text-primary" />
                              <span>{item.title}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))
                  )}
                </ul>
              </motion.div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}

        <NavigationMenuItem>
          <Link href="/pricing" className="px-4 py-2 text-sm font-medium hover:text-primary">
            Cennik
          </Link>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
