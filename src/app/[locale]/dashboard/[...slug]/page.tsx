import { notFound } from "next/navigation";

/**
 * Dashboard catch-all route
 *
 * Catches all unknown routes under /dashboard/* and triggers
 * the dashboard/not-found.tsx component.
 */
export default function DashboardCatchAll() {
  notFound();
}
