import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function UsersIndexPage() {
  const locale = await getLocale();
  return redirect({ href: "/dashboard/organization/users/members", locale });
}
