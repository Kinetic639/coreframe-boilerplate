import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

// Branches moved to /dashboard/organization/branches
export default async function BranchesRedirect() {
  const locale = await getLocale();
  return redirect({ href: "/dashboard/organization/branches", locale });
}
