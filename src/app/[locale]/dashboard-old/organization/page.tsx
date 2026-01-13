import { redirect } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function OrganizationPage({ params }: Props) {
  const { locale } = await params;

  // Redirect to the organization profile page as the default
  redirect({
    href: "/dashboard-old/organization/profile",
    locale,
  });
}
