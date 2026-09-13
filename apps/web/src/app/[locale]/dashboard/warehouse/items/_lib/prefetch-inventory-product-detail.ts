import type { QueryClient } from "@tanstack/react-query";
import type { DataViewScope } from "@/lib/data-view/types";
import type { InventoryProductDetail } from "@/lib/warehouse/inventory-types";
import { prefetchDataViewDetail } from "@/components/data-view/data-view-ssr";
import { getInventoryProductIdFromSelection } from "@/lib/warehouse/inventory-product-selection";

export function prefetchInventoryProductDetail(args: {
  queryClient: QueryClient;
  scope: DataViewScope;
  selectedId: string;
  fetchProduct: (productId: string) => Promise<InventoryProductDetail | null>;
}) {
  return prefetchDataViewDetail({
    queryClient: args.queryClient,
    entity: "inventory-products",
    scope: args.scope,
    selectedId: args.selectedId,
    fetcher: () => args.fetchProduct(getInventoryProductIdFromSelection(args.selectedId)),
  });
}
