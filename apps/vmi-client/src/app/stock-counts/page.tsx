import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";
import { requireDemoSession } from "@/lib/demo-session";

export default async function StockCountsPage() {
  await requireDemoSession();

  return (
    <VmiAppShell activeHref="/stock-counts">
      <RoutePlaceholder href="/stock-counts" />
    </VmiAppShell>
  );
}
