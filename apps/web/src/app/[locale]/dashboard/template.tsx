import { Suspense } from "react";
import Loader from "@/components/ui/Loader";

/**
 * Dashboard V2 Template
 *
 * This template wraps all pages in the dashboard-v2 route group.
 * It provides a consistent loading boundary to prevent flashing of
 * the public layout during navigation or when accessing unknown routes.
 *
 * The template re-renders on every route change, ensuring the loading
 * state is always shown within the dashboard layout context.
 */

function DashboardLoadingFallback() {
  return <Loader fullScreen message="Loading dashboard..." className="bg-muted/20" />;
}

export default function DashboardV2Template({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<DashboardLoadingFallback />}>{children}</Suspense>;
}
