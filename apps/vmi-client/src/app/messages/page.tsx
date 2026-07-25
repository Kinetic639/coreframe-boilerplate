import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function MessagesPage() {
  await requireDemoSession();

  const threads = await VmiPortalRepository.listMessageThreads();
  if (!threads.success) throw new Error(threads.error);

  return (
    <VmiAppShell activeHref="/messages">
      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Czat VMI
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">
            Wiadomosci z dostawcami
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mockowane watki rozmow w kontekscie dostaw, zamowien i stanow magazynowych.
          </p>
        </div>

        <div className="grid gap-3">
          {threads.data.map((thread) => (
            <article key={thread.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-foreground">{thread.subject}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ostatnia aktywnosc: {new Date(thread.lastUpdated).toLocaleString("pl-PL")}
                  </p>
                </div>
                {thread.unreadCount > 0 ? (
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                    {thread.unreadCount}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </VmiAppShell>
  );
}
