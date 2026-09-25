"use client";

import { createContext, useContext, useEffect, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";

/** Align RSC children with the shell's tab-local branch without modifying the shared shell. */
export function HomeScopeBoundary({
  orgId,
  branchId,
  children,
  loadingLabel,
}: {
  orgId: string | null;
  branchId: string | null;
  children: ReactNode;
  loadingLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const activeOrgId = useAppStoreV2((s) => s.activeOrgId);
  const activeBranchId = useAppStoreV2((s) => s.activeBranchId);
  const loaded = useAppStoreV2((s) => s.isLoaded);
  const mismatch = loaded && (activeOrgId !== orgId || activeBranchId !== branchId);
  useEffect(() => {
    if (!mismatch) return;
    startTransition(() => {
      const next = new URLSearchParams(params.toString());
      if (activeBranchId) next.set("branch", activeBranchId);
      else next.delete("branch");
      router.replace(`${pathname}?${next}`, { scroll: false });
    });
  }, [mismatch, activeBranchId, params, pathname, router]);
  const refresh = () => startTransition(() => router.refresh());
  return (
    <HomeRefreshContext.Provider value={{ busy: pending || mismatch, refresh }}>
      <div
        className="relative min-w-0 space-y-3"
        aria-busy={pending || mismatch}
        data-testid="home-dashboard"
      >
        {mismatch ? (
          <p role="status" className="py-10 text-sm text-muted-foreground">
            {loadingLabel}
          </p>
        ) : (
          children
        )}
      </div>
    </HomeRefreshContext.Provider>
  );
}

const HomeRefreshContext = createContext({ busy: false, refresh: () => undefined });

export function HomeRefreshControl({
  refreshLabel,
  refreshedAtLabel,
}: {
  refreshLabel: string;
  refreshedAtLabel: string | null;
}) {
  const { busy, refresh } = useContext(HomeRefreshContext);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 max-w-full justify-start gap-2 bg-background/80 px-2.5 shadow-sm backdrop-blur-sm"
      disabled={busy}
      onClick={refresh}
      aria-label={refreshedAtLabel ? `${refreshLabel}. ${refreshedAtLabel}` : refreshLabel}
    >
      <RefreshCw
        aria-hidden="true"
        className={`size-3.5 shrink-0 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`}
      />
      <span className="truncate text-[11px]">{refreshedAtLabel ?? refreshLabel}</span>
    </Button>
  );
}
