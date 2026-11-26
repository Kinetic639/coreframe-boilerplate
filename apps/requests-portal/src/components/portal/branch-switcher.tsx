"use client";

import { useTransition } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { setActiveBranchAction } from "@/app/actions/portal";
import type { PortalBranch } from "@/server/portal-context";

export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: PortalBranch[];
  activeBranchId: string | null;
}) {
  const t = useTranslations("portal.branch");
  const [pending, startTransition] = useTransition();
  const active = branches.find((b) => b.id === activeBranchId);
  const label = active?.name ?? (branches.length === 1 ? branches[0]!.name : t("all"));
  const pick = (id: string | null) => startTransition(() => setActiveBranchAction(id));

  if (branches.length === 1) {
    return (
      <span className="flex h-9 min-w-0 items-center gap-2 px-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium outline-none ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="max-w-[7.5rem] truncate sm:max-w-[14rem]">{label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => pick(null)} className="justify-between gap-6">
          {t("all")}
          {!activeBranchId && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onSelect={() => pick(b.id)}
            className="justify-between gap-6"
          >
            {b.name}
            {b.id === activeBranchId && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
