import { notFound } from "next/navigation";

/**
 * Unknown dashboard URLs use the localized dashboard 404 boundary, which
 * offers the dashboard home link and a back button without hiding the bad URL.
 */
export default function DashboardCatchAll() {
  notFound();
}
