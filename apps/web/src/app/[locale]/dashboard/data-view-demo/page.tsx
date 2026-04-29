/**
 * /dashboard/data-view-demo — DataView System Demo Page
 *
 * Server component: reads searchParams, generates SSR initial data,
 * then hands off to the client DataViewDemoClient.
 */

import React from "react";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { DataViewDemoClient } from "./data-view-demo-client";
import { resolveDemoProductPage } from "./actions";
import { ALL_PRODUCTS, filterAndSortProducts, paginateProducts } from "./mock-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DataViewDemoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const urlState = parseDataViewSearchParams(params);

  const filteredRows = filterAndSortProducts(ALL_PRODUCTS, {
    search: urlState.search,
    filters: urlState.filters,
    sort: urlState.sort,
  });

  const initialData = paginateProducts(filteredRows, urlState.page, urlState.pageSize);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DataView Demo</h1>
        <p className="text-sm text-muted-foreground">
          Generic Master–Detail workspace. URL-driven state via nuqs, TanStack Query for caching,
          Framer Motion for the detail panel animation. Click any row to open details.
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <DataViewDemoClient
          initialData={initialData}
          resolveSelectedPage={resolveDemoProductPage}
        />
      </div>
    </div>
  );
}
