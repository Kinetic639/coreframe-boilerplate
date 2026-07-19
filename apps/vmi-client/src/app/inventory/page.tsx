import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function InventoryPage() {
  return (
    <VmiAppShell activeHref="/inventory">
      <RoutePlaceholder href="/inventory" />
    </VmiAppShell>
  );
}
