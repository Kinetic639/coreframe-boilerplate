"use client";

import * as React from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface CompactBreadcrumbsProps {
  breadcrumbs?: Breadcrumb[];
  className?: string;
}

/**
 * Compact Breadcrumbs
 *
 * Compact breadcrumb navigation optimized for status bars and tight spaces.
 * Features:
 * - Home icon linking to dashboard
 * - Smaller icons and text (h-3 w-3, text-xs)
 * - Tighter spacing for compact layouts
 *
 * Example usage:
 * ```tsx
 * <CompactBreadcrumbs
 *   breadcrumbs={[
 *     { label: "Warehouse", href: "/dashboard/warehouse" },
 *     { label: "Products" }
 *   ]}
 * />
 * ```
 */
export function CompactBreadcrumbs({ breadcrumbs = [], className }: CompactBreadcrumbsProps) {
  return (
    <nav className={cn("flex items-center gap-0.5 text-xs text-muted-foreground", className)}>
      <Link href={"/dashboard/start" as any} className="hover:text-foreground">
        <Home className="h-3 w-3" />
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="h-3 w-3" />
          {crumb.href ? (
            <Link href={crumb.href as any} className="hover:text-foreground">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
