"use client";

import { ReactNode } from "react";
import { hasMatchingRole } from "@/utils/auth/hasMatchingRole";
import { RoleCheck, Scope } from "@/lib/types/user";
import { useUserStore } from "@/lib/stores/user-store";
import { useAppStore } from "@/lib/stores/app-store";

type Props = {
  checks?: RoleCheck[];
  allowedUsers?: { role: string; scope: Scope }[];
  children: ReactNode;
  fallback?: ReactNode;
};

export default function HasAnyRoleClient({
  checks = [],
  allowedUsers,
  children,
  fallback = null,
}: Props) {
  const roles = useUserStore((s) => s.roles);
  const activeOrgId = useAppStore((s) => s.activeOrgId);
  const activeBranchId = useAppStore((s) => s.activeBranchId);

  const combinedChecks: RoleCheck[] = checks.length
    ? checks
    : (allowedUsers ?? []).map((u) => ({
        role: u.role,
        scope: u.scope,
        id: u.scope === "org" ? (activeOrgId ?? undefined) : (activeBranchId ?? undefined),
      }));

  const hasAccess = hasMatchingRole(roles, combinedChecks);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
