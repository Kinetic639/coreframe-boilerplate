import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The QR codes list moved to Organization → QR codes. Old links (bookmarks,
 * global search hits) keep working: same query string, new address.
 */
export default async function QrCodesMovedPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((searchParams ? await searchParams : {}) ?? {})) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  const path = getPathname({ locale, href: "/dashboard/organization/qr-codes" });
  const query = params.toString();
  return redirect(query ? `${path}?${query}` : path);
}
