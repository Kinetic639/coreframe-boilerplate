import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function OrganizationPublicProfileIndexPage() {
  const locale = await getLocale();

  return redirect({
    href: {
      pathname: "/dashboard/organization/public-profile/[tab]",
      params: { tab: "organization" },
    },
    locale,
  });
}
