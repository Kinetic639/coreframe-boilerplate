import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { SettingsExperience } from "@/components/vmi-portal/settings-experience";
import { requireVmiAccess } from "@/lib/vmi-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function SettingsPage() {
  await requireVmiAccess();

  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <VmiAppShell activeHref="/settings">
      <SettingsExperience user={snapshot.data.user} />
    </VmiAppShell>
  );
}
