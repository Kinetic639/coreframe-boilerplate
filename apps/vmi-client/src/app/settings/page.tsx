import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function SettingsPage() {
  return (
    <VmiAppShell activeHref="/settings">
      <RoutePlaceholder href="/settings" />
    </VmiAppShell>
  );
}
