"use client";

import { NavItem } from "@/modules/documentation/utils/doc-loader";
import { cn } from "@/lib/utils";

interface DocNavigationProps {
  items: NavItem[];
  currentPath: string;
  locale: string;
}

export function DocNavigation({ items, currentPath, locale }: DocNavigationProps) {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = currentPath === item.path;

        return (
          <a
            key={item.slug}
            href={`/${locale}/dashboard/docs${item.path}`}
            className={cn(
              "block px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-100 font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {item.title}
          </a>
        );
      })}
    </nav>
  );
}
