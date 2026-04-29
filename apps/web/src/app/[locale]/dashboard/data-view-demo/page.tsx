/**
 * /dashboard/data-view-demo — DataView System Demo Page
 *
 * Server component: reads searchParams, generates SSR initial data,
 * then hands off to the client DataViewDemoClient.
 */

import React from "react";
import { getTranslations } from "next-intl/server";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { DataViewDemoClient } from "./data-view-demo-client";
import { resolveDemoProductPage } from "./actions";
import { ALL_PRODUCTS, filterAndSortProducts, paginateProducts } from "./mock-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DataViewDemoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = await getTranslations("dataViewDemo.page");
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
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
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
