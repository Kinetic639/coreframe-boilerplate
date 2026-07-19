import { getRouteByHref, type VmiRouteHref } from "@/lib/navigation";

interface RoutePlaceholderProps {
  href: VmiRouteHref;
}

export function RoutePlaceholder({ href }: RoutePlaceholderProps) {
  const route = getRouteByHref(href);

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
          Faza 1: szkielet aplikacji
        </p>
        <h1 className="font-display text-3xl font-black tracking-normal text-foreground">
          {route.title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{route.description}</p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        Ten ekran ma gotową trasę i shell SSR. Realne dane, akcje serwerowe i komponenty z prototypu
        zostaną dodane w kolejnych fazach.
      </div>
    </section>
  );
}
