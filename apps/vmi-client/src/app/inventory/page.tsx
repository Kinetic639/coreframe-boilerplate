import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function InventoryPage() {
  await requireDemoSession();

  const inventory = await VmiPortalRepository.listInventory();
  if (!inventory.success) throw new Error(inventory.error);

  return (
    <VmiAppShell activeHref="/inventory">
      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Zapas VMI
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">
            Monitorowane pozycje
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mockowany widok stanow magazynowych klienta wedlug aktywnej lokalizacji.
          </p>
        </div>

        <div className="grid gap-3">
          {inventory.data.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="font-semibold text-foreground">{item.productName}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {item.clientSku} / {item.unit}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center text-xs md:w-[420px]">
                  <div>
                    <p className="text-muted-foreground">Stan</p>
                    <p className="font-mono text-lg font-black text-foreground">{item.currentStock}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Min</p>
                    <p className="font-mono text-lg font-black text-foreground">{item.minStock}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cel</p>
                    <p className="font-mono text-lg font-black text-foreground">{item.targetStock}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">W drodze</p>
                    <p className="font-mono text-lg font-black text-primary">{item.incomingQty}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {item.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  Aktualizacja: {new Date(item.lastUpdated).toLocaleString("pl-PL")}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </VmiAppShell>
  );
}
