import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { PortalVendorsExperience } from "@/components/vmi-portal/portal-vendors-experience";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function PortalVendorsPage() {
  await requireDemoSession();

  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <VmiAppShell activeHref="/portal/vendors">
      <PortalVendorsExperience
        vendors={snapshot.data.vendors}
        proposals={snapshot.data.proposals}
        orders={snapshot.data.orders}
        messageThreads={snapshot.data.messageThreads}
      />
    </VmiAppShell>
  );
}
