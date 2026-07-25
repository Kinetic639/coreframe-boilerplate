import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function OrdersPage() {
  await requireDemoSession();

  const orders = await VmiPortalRepository.listOrders();
  if (!orders.success) throw new Error(orders.error);

  return (
    <VmiAppShell activeHref="/orders">
      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Zamowienia VMI
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">
            Aktywne zamowienia
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mockowane zamowienia reczne i utworzone z zaakceptowanych propozycji.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 border-b border-border bg-muted/50 p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Numer</span>
            <span>Status</span>
            <span>Dostawa</span>
            <span className="text-right">Wartosc</span>
          </div>
          {orders.data.map((order) => (
            <article
              key={order.id}
              className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 border-b border-border p-3 text-sm last:border-b-0"
            >
              <span className="font-mono font-bold text-foreground">{order.orderNumber}</span>
              <span className="text-muted-foreground">{order.status}</span>
              <span className="text-muted-foreground">{order.requestedDeliveryDate}</span>
              <span className="text-right font-mono font-black text-foreground">
                {order.totalValue.toLocaleString("pl-PL")} PLN
              </span>
            </article>
          ))}
        </div>
      </section>
    </VmiAppShell>
  );
}
