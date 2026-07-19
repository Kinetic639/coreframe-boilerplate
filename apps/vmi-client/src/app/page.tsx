import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { getRouteByHref } from "@/lib/navigation";

export default function HomePage() {
  const route = getRouteByHref("/");

  return (
    <VmiAppShell activeHref="/">
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Portal klienta VMI
          </p>
          <h1 className="font-display text-3xl font-black tracking-normal text-slate-950">
            {route.title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">{route.description}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Aktywni dostawcy", "4"],
            ["Pozycje poniżej minimum", "18"],
            ["Oczekujące propozycje", "3"]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </VmiAppShell>
  );
}
