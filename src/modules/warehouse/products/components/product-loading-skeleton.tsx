import * as React from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filters and Display Mode Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
          <Skeleton className="h-10 flex-grow" />
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>

      {/* Product Listing */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="flex h-full flex-col overflow-hidden rounded-lg shadow-md">
                <Skeleton className="relative h-48 w-full rounded-t-lg" />
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="mt-2 flex items-center justify-between">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
                <CardFooter className="pt-2">
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
