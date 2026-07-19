import Link from "next/link";
import { Database, Plus } from "lucide-react";
import { vmiRoutes, type VmiRouteHref } from "@/lib/navigation";
import { cn } from "@/utils/cn";

interface VmiAppShellProps {
  activeHref: VmiRouteHref;
  children: React.ReactNode;
}

export function VmiAppShell({ activeHref, children }: VmiAppShellProps) {
  const activeRoute = vmiRoutes.find((route) => route.href === activeHref) ?? vmiRoutes[0];

  return (
    <div className="min-h-screen bg-muted text-foreground md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-background md:flex md:flex-col">
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-black text-primary-foreground shadow-sm">
              <span>A</span>
            </div>
            <div>
              <p className="font-display text-sm font-black text-foreground">Ambra VMI</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Portal klienta
              </p>
            </div>
          </div>
        </div>

        <div className="mx-3 rounded-md bg-accent/40 p-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Monitorowana lokalizacja
              </p>
              <p className="text-xs font-bold text-foreground">Do konfiguracji</p>
            </div>
          </div>
        </div>

        <nav className="mt-5 flex-1 space-y-1 px-3">
          {vmiRoutes.map((route) => {
            const Icon = route.icon;
            const isActive = route.href === activeHref;

            return (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {route.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <Link
            href="/stock-counts"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-3 text-xs font-black text-primary-foreground shadow-sm transition-colors hover:bg-amber-600"
          >
            <Plus className="h-4 w-4" />
            Inwentaryzacja VMI
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-sm font-black text-foreground">Ambra VMI</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {activeRoute.label}
              </p>
            </div>
            <div className="rounded-md bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
              Do konfiguracji
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 md:p-8">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-border bg-background/95 px-2 py-2 backdrop-blur md:hidden">
          {vmiRoutes.slice(0, 7).map((route) => {
            const Icon = route.icon;
            const isActive = route.href === activeHref;

            return (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-bold",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{route.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
