"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCheck, UserX, Trash2, Briefcase, Shield, ExternalLink, GitBranch } from "lucide-react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { MEMBERS_MANAGE } from "@/lib/constants/permissions";
import {
  useMembersQuery,
  usePositionsQuery,
  useAssignmentsQuery,
  useRolesQuery,
  useBranchesQuery,
  useUpdateMemberStatusMutation,
  useRemoveMemberMutation,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAssignPositionMutation,
  useRemovePositionAssignmentMutation,
  useMembersRealtimeSync,
} from "@/hooks/queries/organization";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import type {
  OrgMember,
  OrgPosition,
  OrgPositionAssignment,
  OrgRole,
  OrgBranch,
} from "@/server/services/organization.service";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { filterSortMembers, paginateMembers } from "../_utils/data-view";

const MEMBERS_DV_KEY = ["org-members-dataview"];

interface MembersClientProps {
  initialData: PaginatedResult<OrgMember>;
  allMembers: OrgMember[];
  initialPositions: OrgPosition[];
  initialAssignments: OrgPositionAssignment[];
  initialRoles: OrgRole[];
  initialBranches: OrgBranch[];
}

type RoleScopeConfig = { scope: "org" | "branch"; branchIds: string[] };

export function MembersClient({
  initialData,
  allMembers: initialAllMembers,
  initialPositions,
  initialAssignments,
  initialRoles,
  initialBranches,
}: MembersClientProps) {
  const t = useTranslations("modules.organizationManagement.members");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const activeOrgId = useAppStoreV2((s) => s.activeOrgId);

  useMembersRealtimeSync(activeOrgId);

  const allRef = useRef(initialAllMembers);
  allRef.current = initialAllMembers;

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<OrgMember>> => {
      const filtered = filterSortMembers(allRef.current, params);
      return paginateMembers(filtered, params.page, params.pageSize);
    },
    []
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<OrgMember | null> =>
      allRef.current.find((m) => m.user_id === id) ?? null,
    []
  );

  const { data: positions } = usePositionsQuery(initialPositions);
  const { data: assignments } = useAssignmentsQuery(initialAssignments);
  const { data: availableRoles } = useRolesQuery(initialRoles);
  const { data: branches } = useBranchesQuery(initialBranches);

  // Keep members cache seeded (for reactivity after mutations via existing hooks)
  useMembersQuery(initialAllMembers);

  const statusMutation = useUpdateMemberStatusMutation();
  const removeMutation = useRemoveMemberMutation();
  const assignRoleMutation = useAssignRoleToUserMutation();
  const removeRoleMutation = useRemoveRoleFromUserMutation();
  const assignPositionMutation = useAssignPositionMutation();
  const removePositionMutation = useRemovePositionAssignmentMutation();

  const isPending =
    statusMutation.isPending ||
    removeMutation.isPending ||
    assignRoleMutation.isPending ||
    removeRoleMutation.isPending ||
    assignPositionMutation.isPending ||
    removePositionMutation.isPending;

  const canManage = can(MEMBERS_MANAGE);

  // Derived maps
  const positionByUser = useMemo(
    () => new Map(assignments.filter((a) => !a.deleted_at).map((a) => [a.user_id, a])),
    [assignments]
  );
  const branchNameMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [assignPositionMember, setAssignPositionMember] = useState<OrgMember | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [assignRoleMember, setAssignRoleMember] = useState<OrgMember | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleScopeConfigs, setRoleScopeConfigs] = useState<Map<string, RoleScopeConfig>>(new Map());

  const refreshAfterMutation = async () => {
    await queryClient.invalidateQueries({ queryKey: MEMBERS_DV_KEY });
    router.refresh();
  };

  // ── Status toggle ─────────────────────────────────────────────────────────────
  const handleStatusToggle = (member: OrgMember) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    statusMutation.mutate(
      { userId: member.user_id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(newStatus === "active" ? t("toasts.activated") : t("toasts.deactivated"));
          void refreshAfterMutation();
        },
      }
    );
  };

  const handleRemove = (member: OrgMember) => {
    removeMutation.mutate(
      { userId: member.user_id },
      { onSuccess: () => void refreshAfterMutation() }
    );
  };

  // ── Position dialog ───────────────────────────────────────────────────────────
  const openAssignPosition = (member: OrgMember) => {
    setSelectedPositionId(positionByUser.get(member.user_id)?.position_id ?? "");
    setAssignPositionMember(member);
  };

  const handleAssignPosition = async () => {
    if (!assignPositionMember) return;
    const existing = positionByUser.get(assignPositionMember.user_id);
    if (existing && existing.position_id === selectedPositionId) {
      setAssignPositionMember(null);
      return;
    }
    try {
      if (existing) await removePositionMutation.mutateAsync({ assignmentId: existing.id });
      if (selectedPositionId) {
        await assignPositionMutation.mutateAsync({
          userId: assignPositionMember.user_id,
          positionId: selectedPositionId,
        });
        toast.success(t("toasts.positionAssigned"));
      } else {
        toast.success(t("toasts.positionRemoved"));
      }
      setAssignPositionMember(null);
      void refreshAfterMutation();
    } catch {
      setAssignPositionMember(null);
    }
  };

  // ── Role dialog ───────────────────────────────────────────────────────────────
  const openAssignRoles = (member: OrgMember) => {
    const uniqueRoleIds = [...new Set(member.roles.map((r) => r.id))];
    setSelectedRoleIds(uniqueRoleIds);
    const initConfigs = new Map<string, RoleScopeConfig>();
    for (const r of member.roles) {
      const existing = initConfigs.get(r.id);
      if (r.scope === "branch") {
        initConfigs.set(r.id, {
          scope: "branch",
          branchIds: [...(existing?.branchIds ?? []), r.scope_id],
        });
      } else if (!existing) {
        initConfigs.set(r.id, { scope: "org", branchIds: [] });
      }
    }
    setRoleScopeConfigs(initConfigs);
    setAssignRoleMember(member);
  };

  const toggleRole = (roleId: string, scopeType: string) => {
    setSelectedRoleIds((prev) => {
      if (prev.includes(roleId)) {
        setRoleScopeConfigs((cfg) => {
          const next = new Map(cfg);
          next.delete(roleId);
          return next;
        });
        return prev.filter((id) => id !== roleId);
      }
      const defaultScope: "org" | "branch" = scopeType === "branch" ? "branch" : "org";
      setRoleScopeConfigs((cfg) =>
        new Map(cfg).set(roleId, { scope: defaultScope, branchIds: [] })
      );
      return [...prev, roleId];
    });
  };

  const setRoleScope = (roleId: string, scope: "org" | "branch") => {
    setRoleScopeConfigs((prev) => {
      const next = new Map(prev);
      const ex = next.get(roleId) ?? { scope: "org", branchIds: [] };
      next.set(roleId, { ...ex, scope, branchIds: scope === "org" ? [] : ex.branchIds });
      return next;
    });
  };

  const toggleBranchForRole = (roleId: string, branchId: string) => {
    setRoleScopeConfigs((prev) => {
      const next = new Map(prev);
      const ex = next.get(roleId) ?? { scope: "branch", branchIds: [] };
      const has = ex.branchIds.includes(branchId);
      next.set(roleId, {
        ...ex,
        branchIds: has ? ex.branchIds.filter((id) => id !== branchId) : [...ex.branchIds, branchId],
      });
      return next;
    });
  };

  const handleSaveRoles = async () => {
    if (!assignRoleMember) return;
    const currentIds = [...new Set(assignRoleMember.roles.map((r) => r.id))];
    const toRemove = currentIds.filter((id) => !selectedRoleIds.includes(id));
    const toAdd = selectedRoleIds.filter((id) => !currentIds.includes(id));
    const toUpdate = selectedRoleIds.filter((id) => currentIds.includes(id));
    let changed = toAdd.length > 0 || toRemove.length > 0;
    try {
      for (const roleId of toRemove) {
        for (const a of assignRoleMember.roles.filter((r) => r.id === roleId)) {
          await removeRoleMutation.mutateAsync({
            userId: assignRoleMember.user_id,
            roleId,
            scope: a.scope,
            scopeId: a.scope_id,
          });
        }
      }
      for (const roleId of toUpdate) {
        const config = roleScopeConfigs.get(roleId);
        if (!config) continue;
        const current = assignRoleMember.roles.filter((r) => r.id === roleId);
        const currentOrg = current.find((a) => a.scope === "org");
        const currentBranchIds = current.filter((a) => a.scope === "branch").map((a) => a.scope_id);
        if (config.scope === "org") {
          for (const bid of currentBranchIds) {
            changed = true;
            await removeRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId: bid,
            });
          }
          if (!currentOrg) {
            changed = true;
            await assignRoleMutation.mutateAsync({ userId: assignRoleMember.user_id, roleId });
          }
        } else {
          if (currentOrg) {
            changed = true;
            await removeRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "org",
              scopeId: currentOrg.scope_id,
            });
          }
          for (const bid of currentBranchIds.filter((id) => !config.branchIds.includes(id))) {
            changed = true;
            await removeRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId: bid,
            });
          }
          for (const bid of config.branchIds.filter((id) => !currentBranchIds.includes(id))) {
            changed = true;
            await assignRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId: bid,
            });
          }
        }
      }
      for (const roleId of toAdd) {
        const config = roleScopeConfigs.get(roleId);
        if (!config) continue;
        if (config.scope === "branch") {
          if (!config.branchIds.length) continue;
          for (const bid of config.branchIds)
            await assignRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId: bid,
            });
        } else {
          await assignRoleMutation.mutateAsync({ userId: assignRoleMember.user_id, roleId });
        }
      }
      if (changed) toast.success(t("toasts.rolesUpdated"));
      setAssignRoleMember(null);
      void refreshAfterMutation();
    } catch {
      setAssignRoleMember(null);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getInitials = (m: OrgMember) => {
    if (m.user_first_name && m.user_last_name)
      return `${m.user_first_name[0]}${m.user_last_name[0]}`.toUpperCase();
    return (m.user_email ?? "?")[0].toUpperCase();
  };

  const displayName = (m: OrgMember) =>
    m.user_first_name || m.user_last_name
      ? `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim()
      : (m.user_email ?? t("unknown"));

  // ── DataView definitions ──────────────────────────────────────────────────────
  const columns = useMemo<DataViewColumnDef<OrgMember>[]>(
    () => [
      {
        key: "member",
        header: t("columns.member"),
        accessor: (row) => (
          <div className="flex items-center gap-3 py-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={row.user_avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{getInitials(row)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{displayName(row)}</p>
              {(row.user_first_name || row.user_last_name) && (
                <p className="truncate text-xs text-muted-foreground">{row.user_email}</p>
              )}
            </div>
          </div>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "status",
        header: t("columns.status"),
        accessor: (row) => (
          <Badge
            variant={row.status === "active" ? "default" : "secondary"}
            className="text-xs capitalize"
          >
            {row.status === "active" ? t("statusOptions.active") : t("statusOptions.inactive")}
          </Badge>
        ),
        sortable: true,
        defaultVisible: true,
        compactLabel: true,
      },
      {
        key: "roles",
        header: t("columns.roles"),
        accessor: (row) => {
          const unique = new Map<string, { name: string; scope: string; branchNames: string[] }>();
          for (const r of row.roles) {
            const ex = unique.get(r.id);
            if (ex) {
              if (r.scope === "branch") {
                const n = branchNameMap.get(r.scope_id);
                if (n) ex.branchNames.push(n);
              }
            } else {
              unique.set(r.id, {
                name: r.name,
                scope: r.scope,
                branchNames:
                  r.scope === "branch"
                    ? branchNameMap.get(r.scope_id)
                      ? [branchNameMap.get(r.scope_id)!]
                      : []
                    : [],
              });
            }
          }
          const list = [...unique.values()];
          if (!list.length) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {list.slice(0, 2).map((role, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1 py-0">
                  <Shield className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate max-w-[80px]">{role.name}</span>
                </Badge>
              ))}
              {list.length > 2 && (
                <Badge variant="secondary" className="text-xs py-0">
                  +{list.length - 2}
                </Badge>
              )}
            </div>
          );
        },
        defaultVisible: true,
      },
      {
        key: "position",
        header: t("columns.position"),
        accessor: (row) => {
          const pos = positionByUser.get(row.user_id);
          return pos?.position_name ? (
            <Badge variant="outline" className="text-xs gap-1 py-0">
              <Briefcase className="h-2.5 w-2.5" />
              {pos.position_name}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
        defaultVisible: true,
      },
      {
        key: "joined",
        header: t("columns.joined"),
        accessor: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.joined_at ? new Date(row.joined_at).toLocaleDateString() : "—"}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
    ],
    [t, positionByUser, branchNameMap]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "select",
        key: "status",
        label: t("filters.status"),
        options: [
          { label: t("statusOptions.active"), value: "active" },
          { label: t("statusOptions.inactive"), value: "inactive" },
        ],
      },
    ],
    [t]
  );

  const renderCompactItem = useCallback(
    (row: OrgMember) => (
      <div className="flex items-center gap-2 py-0.5">
        <Avatar className="h-5 w-5 shrink-0">
          <AvatarImage src={row.user_avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">{getInitials(row)}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-medium">{displayName(row)}</span>
      </div>
    ),
    [positionByUser, branchNameMap]
  );

  const renderDetail = useCallback(
    (member: OrgMember) => {
      const posAssignment = positionByUser.get(member.user_id);
      const uniqueRoles = new Map<string, { name: string; scope: string; branchNames: string[] }>();
      for (const r of member.roles) {
        const ex = uniqueRoles.get(r.id);
        if (ex) {
          if (r.scope === "branch") {
            const n = branchNameMap.get(r.scope_id);
            if (n) ex.branchNames.push(n);
          }
        } else {
          uniqueRoles.set(r.id, {
            name: r.name,
            scope: r.scope,
            branchNames:
              r.scope === "branch"
                ? branchNameMap.get(r.scope_id)
                  ? [branchNameMap.get(r.scope_id)!]
                  : []
                : [],
          });
        }
      }
      const roleList = [...uniqueRoles.values()];

      return (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={member.user_avatar_url ?? undefined} />
              <AvatarFallback>{getInitials(member)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">{displayName(member)}</h2>
              <p className="text-sm text-muted-foreground">{member.user_email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.status")}
              </p>
              <Badge
                variant={member.status === "active" ? "default" : "secondary"}
                className="text-xs capitalize"
              >
                {member.status === "active"
                  ? t("statusOptions.active")
                  : t("statusOptions.inactive")}
              </Badge>
            </div>
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.joined")}
              </p>
              <span>
                {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "—"}
              </span>
            </div>
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.position")}
              </p>
              {posAssignment?.position_name ? (
                <Badge variant="outline" className="text-xs gap-1 py-0">
                  <Briefcase className="h-2.5 w-2.5" />
                  {posAssignment.position_name}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">{t("detail.noPosition")}</span>
              )}
            </div>
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.email")}
              </p>
              <span className="text-xs break-all">{member.user_email}</span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("detail.roles")}
            </p>
            {roleList.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("detail.noRoles")}</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {roleList.map((role, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1 py-0">
                    <Shield className="h-2.5 w-2.5 shrink-0" />
                    <span>{role.name}</span>
                    {role.scope === "branch" && role.branchNames.length > 0 && (
                      <span className="opacity-60 font-normal">
                        · {role.branchNames.join(", ")}
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Link
              href={{
                pathname: "/dashboard/organization/users/members/[memberId]",
                params: { memberId: member.user_id },
              }}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("detail.viewDetails")}
            </Link>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusToggle(member)}
                disabled={isPending}
              >
                {member.status === "active" ? (
                  <>
                    <UserX className="mr-1.5 h-3.5 w-3.5" />
                    {t("actions.deactivate")}
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                    {t("actions.activate")}
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAssignRoles(member)}
                disabled={isPending}
              >
                <Shield className="mr-1.5 h-3.5 w-3.5" />
                {t("actions.manageRoles")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAssignPosition(member)}
                disabled={isPending}
              >
                <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                {posAssignment ? t("actions.changePosition") : t("actions.assignPosition")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => handleRemove(member)}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("actions.removeMember")}
              </Button>
            </div>
          )}
        </div>
      );
    },
    [t, canManage, isPending, positionByUser, branchNameMap]
  );

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <DataView<OrgMember, OrgMember>
            entity="org-members"
            columns={columns}
            filters={filters}
            initialData={initialData}
            queryKey={MEMBERS_DV_KEY}
            listFetcher={listFetcher}
            detailFetcher={detailFetcher}
            getRowId={(row) => row.user_id}
            renderCompactItem={renderCompactItem}
            renderDetail={renderDetail}
            className="h-full"
          />
        </div>
      </div>

      {/* Manage Roles Dialog */}
      <Dialog
        open={assignRoleMember !== null}
        onOpenChange={(open) => !open && setAssignRoleMember(null)}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("manageRolesDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 max-h-80 overflow-y-auto pr-1">
            {availableRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("manageRolesDialog.noRoles")}</p>
            ) : (
              availableRoles.map((role) => {
                const isChecked = selectedRoleIds.includes(role.id);
                const config = roleScopeConfigs.get(role.id);
                const showBranchSelector =
                  isChecked &&
                  (role.scope_type === "branch" ||
                    (role.scope_type === "both" && config?.scope === "branch"));
                return (
                  <div key={role.id} className="space-y-2">
                    <div className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={isChecked}
                        onCheckedChange={() =>
                          !role.is_basic && toggleRole(role.id, role.scope_type)
                        }
                        disabled={isPending || role.is_basic}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`role-${role.id}`}
                        className={`flex-1 ${role.is_basic ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{role.name}</span>
                          {role.is_basic && (
                            <Badge variant="secondary" className="text-xs">
                              {t("manageRolesDialog.systemBadge")}
                            </Badge>
                          )}
                          {role.scope_type === "branch" && (
                            <Badge
                              variant="outline"
                              className="text-xs gap-1 py-0 text-blue-600 border-blue-300"
                            >
                              <GitBranch className="h-2.5 w-2.5" />
                              {t("manageRolesDialog.scopeBranch")}
                            </Badge>
                          )}
                          {role.scope_type === "both" && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 text-purple-600 border-purple-300"
                            >
                              {t("manageRolesDialog.scopeBranch")}/{t("manageRolesDialog.scopeOrg")}
                            </Badge>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        )}
                      </Label>
                    </div>
                    {isChecked && role.scope_type === "both" && (
                      <div className="ml-7 flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={config?.scope === "org" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setRoleScope(role.id, "org")}
                          disabled={isPending}
                        >
                          {t("manageRolesDialog.scopeOrg")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={config?.scope === "branch" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setRoleScope(role.id, "branch")}
                          disabled={isPending}
                        >
                          {t("manageRolesDialog.scopeBranch")}
                        </Button>
                      </div>
                    )}
                    {showBranchSelector && (
                      <div className="ml-7 space-y-1">
                        {branches.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t("manageRolesDialog.noBranches")}
                          </p>
                        ) : (
                          branches.map((branch) => (
                            <div key={branch.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`branch-${role.id}-${branch.id}`}
                                checked={config?.branchIds.includes(branch.id) ?? false}
                                onCheckedChange={() => toggleBranchForRole(role.id, branch.id)}
                                disabled={isPending}
                              />
                              <Label
                                htmlFor={`branch-${role.id}-${branch.id}`}
                                className="text-xs font-normal cursor-pointer"
                              >
                                {branch.name}
                              </Label>
                            </div>
                          ))
                        )}
                        {config?.branchIds.length === 0 && (
                          <p className="text-xs text-amber-600">
                            {t("manageRolesDialog.selectBranchHint")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignRoleMember(null)}
              disabled={isPending}
            >
              {t("manageRolesDialog.cancel")}
            </Button>
            <Button onClick={handleSaveRoles} disabled={isPending}>
              {isPending ? t("manageRolesDialog.saving") : t("manageRolesDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Position Dialog */}
      <Dialog
        open={assignPositionMember !== null}
        onOpenChange={(open) => !open && setAssignPositionMember(null)}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {positionByUser.get(assignPositionMember?.user_id ?? "")
                ? t("assignPositionDialog.titleChange")
                : t("assignPositionDialog.titleAssign")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedPositionId} onValueChange={setSelectedPositionId}>
              <SelectTrigger>
                <SelectValue placeholder={t("assignPositionDialog.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {positions.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id}>
                    {pos.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {positionByUser.get(assignPositionMember?.user_id ?? "") && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("assignPositionDialog.removeHint")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignPositionMember(null)}
              disabled={isPending}
            >
              {t("assignPositionDialog.cancel")}
            </Button>
            <Button onClick={handleAssignPosition} disabled={isPending}>
              {isPending ? t("assignPositionDialog.saving") : t("assignPositionDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
