"use client";

import * as React from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderV2Props {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Page Header V2
 *
 * Reusable page header component with:
 * - Breadcrumbs navigation with home icon
 * - Title and optional description
 * - Actions slot for buttons/controls
 * - Responsive layout
 *
 * Example usage:
 * ```tsx
 * <PageHeaderV2
 *   title="Products"
 *   description="Manage your product catalog"
 *   breadcrumbs={[
 *     { label: "Warehouse", href: "/dashboard-v2/warehouse" },
 *     { label: "Products" }
 *   ]}
 *   actions={<Button>Add Product</Button>}
 * />
 * ```
 */
export function PageHeaderV2({
  title,
  description,
  breadcrumbs = [],
  actions,
  className,
}: PageHeaderV2Props) {
  return (
    <div className={cn("mb-6", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Link
            href={"/dashboard-v2/start" as any}
            className="hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-4 w-4" />
              {crumb.href ? (
                <Link href={crumb.href as any} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title and Actions Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
