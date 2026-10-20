import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** Blocked stock now has its tab on the "Reservations and blocks" screen. */
export default async function WarehouseBlocksPage() {
  const locale = await getLocale();
  return redirect({
    href: { pathname: "/dashboard/warehouse/reservations", query: { tab: "blocks" } },
    locale,
  });
}
