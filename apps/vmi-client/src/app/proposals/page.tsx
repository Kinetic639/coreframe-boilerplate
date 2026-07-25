import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { ProposalsExperience } from "@/components/vmi-portal/proposals-experience";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function ProposalsPage() {
  await requireDemoSession();

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
