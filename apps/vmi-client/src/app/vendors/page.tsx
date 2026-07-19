import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function VendorsPage() {
  return (
    <VmiAppShell activeHref="/vendors">
      <RoutePlaceholder href="/vendors" />
    </VmiAppShell>
  );
}
