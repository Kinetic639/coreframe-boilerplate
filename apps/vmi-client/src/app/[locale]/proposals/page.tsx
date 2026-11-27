import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { ProposalsExperience } from "@/components/vmi-portal/proposals-experience";
import { requireVmiAccess } from "@/lib/vmi-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function ProposalsPage() {
  await requireVmiAccess();

  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <VmiAppShell activeHref="/proposals">
      <ProposalsExperience
        proposals={snapshot.data.proposals}
        inventory={snapshot.data.inventory}
        vendors={snapshot.data.vendors}
      />
    </VmiAppShell>
  );
}
