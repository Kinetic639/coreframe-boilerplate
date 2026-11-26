import { setRequestLocale } from "next-intl/server";

/** Nothing beside the list until a request is opened (the list is the (requests) layout). */
export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return null;
}
