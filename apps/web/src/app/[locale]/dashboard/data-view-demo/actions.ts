"use server";

import type { DataViewListParams } from "@/components/data-view/data-view.types";
import { ALL_PRODUCTS, resolveProductPage } from "./mock-data";

export async function resolveDemoProductPage(args: {
  selectedId: string;
  listParams: DataViewListParams;
}) {
  return resolveProductPage(ALL_PRODUCTS, args.listParams, args.selectedId);
}
