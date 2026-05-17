import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function WarehouseItemCustomFieldsPage() {
  const locale = await getLocale();
  return redirect({ href: "/dashboard/warehouse/settings", locale });
}
