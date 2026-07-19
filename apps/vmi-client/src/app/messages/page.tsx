import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function MessagesPage() {
  return (
    <VmiAppShell activeHref="/messages">
      <RoutePlaceholder href="/messages" />
    </VmiAppShell>
  );
}
