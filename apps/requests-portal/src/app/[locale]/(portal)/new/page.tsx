import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewRequestPage } from "@/components/requests/new-request-page";
import { requirePortalContext } from "@/server/portal-context";
import { loadNewRequestOptions } from "@/server/requests/new-request-options";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requests.new" });
  return { title: t("heading") };
}

/** New request on its own page: the phone's full-screen form (desktops use the dialog). */
export default async function NewRequestRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [ctx, supabase] = await Promise.all([requirePortalContext(), createClient()]);
  return <NewRequestPage options={await loadNewRequestOptions(supabase, ctx)} />;
}
