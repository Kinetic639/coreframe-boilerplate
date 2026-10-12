import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/**
 * The "Inventory" list page was removed: stock per location is shown on each
 * item's page, and stock changes go through movement documents. Old links and
 * bookmarks land on the items list.
 */
export default async function WarehouseInventoryPage() {
  return redirect({ href: "/dashboard/warehouse/items", locale: await getLocale() });
}
