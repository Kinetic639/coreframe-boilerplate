import { Suspense } from "react";
import { Loader2 } from "lucide-react";

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
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/20">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function DashboardV2Template({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<DashboardLoadingFallback />}>{children}</Suspense>;
}
