import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

// Customer orders live as internal orders (ZW), as in AutoStacja.
export default async function WarehouseSalesOrdersPage() {
  return redirect({ href: "/dashboard/warehouse/internal-orders", locale: await getLocale() });
}
