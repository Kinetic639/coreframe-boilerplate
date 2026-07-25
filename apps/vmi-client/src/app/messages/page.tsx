import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { MessagesExperience } from "@/components/vmi-portal/messages-experience";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function MessagesPage() {
  await requireDemoSession();

  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <VmiAppShell activeHref="/messages">
      <MessagesExperience
        threads={snapshot.data.messageThreads}
        vendors={snapshot.data.vendors}
        orders={snapshot.data.orders}
        inventory={snapshot.data.inventory}
        proposals={snapshot.data.proposals}
      />
    </VmiAppShell>
  );
}
