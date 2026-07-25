import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function ProposalsPage() {
  await requireDemoSession();

  const proposals = await VmiPortalRepository.listProposals();
  if (!proposals.success) throw new Error(proposals.error);

  return (
    <VmiAppShell activeHref="/proposals">
      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Propozycje VMI
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">
            Propozycje uzupelnien
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mockowane propozycje dostawcy oczekujace na decyzje klienta.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {proposals.data.map((proposal) => (
            <article key={proposal.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold text-primary">{proposal.proposalNumber}</p>
                  <h2 className="mt-2 text-lg font-semibold text-foreground">{proposal.status}</h2>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {proposal.urgentLinesCount} pilne
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-background p-3">
                  <p className="text-xs text-muted-foreground">Wartosc</p>
                  <p className="mt-1 font-mono text-lg font-black text-foreground">
                    {proposal.totalValue.toLocaleString("pl-PL")} PLN
                  </p>
                </div>
                <div className="rounded-xl bg-background p-3">
                  <p className="text-xs text-muted-foreground">Wazne do</p>
                  <p className="mt-1 font-mono text-lg font-black text-foreground">
                    {proposal.expiryDate}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </VmiAppShell>
  );
}
