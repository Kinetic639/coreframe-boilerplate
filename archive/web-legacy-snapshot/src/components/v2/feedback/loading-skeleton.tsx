"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  variant?: "text" | "card" | "table" | "form" | "list";
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ variant = "text", count = 1, className }: LoadingSkeletonProps) {
  const renderVariant = () => {
    switch (variant) {
      case "text":
        return (
          <div className={cn("space-y-2", className)}>
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        );

      case "card":
        return (
          <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        );

      case "table":
        return (
          <div className={cn("space-y-2", className)}>
            {/* Table header */}
            <div className="flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
            </div>
            {/* Table rows */}
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-12 flex-1" />
                <Skeleton className="h-12 flex-1" />
                <Skeleton className="h-12 flex-1" />
              </div>
            ))}
          </div>
        );

      case "form":
        return (
          <div className={cn("space-y-4", className)}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        );

      case "list":
        return (
          <div className={cn("space-y-3", className)}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return <Skeleton className={cn("h-4 w-full", className)} />;
    }
  };

  return renderVariant();
}
