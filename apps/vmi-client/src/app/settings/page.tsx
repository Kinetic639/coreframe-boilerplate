import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { RoutePlaceholder } from "@/components/route-placeholder";
import { requireDemoSession } from "@/lib/demo-session";

export default async function SettingsPage() {
  await requireDemoSession();

  return (
    <VmiAppShell activeHref="/settings">
      <RoutePlaceholder href="/settings" />
    </VmiAppShell>
  );
}
