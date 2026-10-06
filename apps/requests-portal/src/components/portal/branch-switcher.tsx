"use client";

import { useTransition } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
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
      <span className="flex h-9 items-center gap-1.5 px-2 text-[13px] font-medium text-stone-600">
        <Building2 className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex h-9 items-center gap-1.5 rounded-[9px] border border-stone-200 bg-white px-2.5 text-[13px] font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
      >
        <Building2 className="h-3.5 w-3.5 text-stone-600" />
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown className="h-3 w-3 text-stone-600" strokeWidth={2.4} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => pick(null)} className="justify-between gap-6">
          {t("all")}
          {!activeBranchId && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem key={b.id} onSelect={() => pick(b.id)} className="justify-between gap-6">
            {b.name}
            {b.id === activeBranchId && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
