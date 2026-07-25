"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderV2Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Page Header V2
 *
 * Reusable page header component with:
 * - Title and optional description
 * - Actions slot for buttons/controls
 * - Responsive layout
 *
 * Note: Breadcrumbs have been moved to the status bar for global navigation.
 *
 * Example usage:
 * ```tsx
 * <PageHeaderV2
 *   title="Products"
 *   description="Manage your product catalog"
 *   actions={<Button>Add Product</Button>}
 * />
 * ```
 */
export function PageHeaderV2({ title, description, actions, className }: PageHeaderV2Props) {
  return (
    <div className={cn("mb-6", className)}>
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
