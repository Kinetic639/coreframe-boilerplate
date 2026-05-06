import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { DataViewDemoClient } from "@/app/[locale]/dashboard/data-view-demo/data-view-demo-client";
import { resolveDemoProductPage } from "@/app/[locale]/dashboard/data-view-demo/actions";
import {
  ALL_PRODUCTS,
  filterAndSortProducts,
  paginateProducts,
} from "@/app/[locale]/dashboard/data-view-demo/mock-data";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDataViewDemoPage({ searchParams }: PageProps) {
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
          Interactive demo of the DataView component — filtering, sorting, pagination, and detail
          panel.
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
