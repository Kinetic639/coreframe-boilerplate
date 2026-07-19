import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function ProposalsPage() {
  return (
    <VmiAppShell activeHref="/proposals">
      <RoutePlaceholder href="/proposals" />
    </VmiAppShell>
  );
}
