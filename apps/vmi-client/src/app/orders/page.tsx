import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function OrdersPage() {
  return (
    <VmiAppShell activeHref="/orders">
      <RoutePlaceholder href="/orders" />
    </VmiAppShell>
  );
}
