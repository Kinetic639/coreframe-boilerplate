import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function StockCountsPage() {
  return (
    <VmiAppShell activeHref="/stock-counts">
      <RoutePlaceholder href="/stock-counts" />
    </VmiAppShell>
  );
}
