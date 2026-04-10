"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  MoreHorizontal,
  UserCheck,
  UserX,
  Trash2,
  Briefcase,
  Shield,
  Eye,
  GitBranch,
} from "lucide-react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
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

interface MembersClientProps {
  initialMembers: OrgMember[];
  initialPositions: OrgPosition[];
  initialAssignments: OrgPositionAssignment[];
  initialRoles: OrgRole[];
  initialBranches: OrgBranch[];
}

// Per-role scope configuration in the manage dialog
type RoleScopeConfig = {
  scope: "org" | "branch";
  branchIds: string[];
};

export function MembersClient({
  initialMembers,
  initialPositions,
  initialAssignments,
  initialRoles,
  initialBranches,
}: MembersClientProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const activeOrgId = useAppStoreV2((s) => s.activeOrgId);

  useMembersRealtimeSync(activeOrgId);

  const { data: members } = useMembersQuery(initialMembers);
  const { data: positions } = usePositionsQuery(initialPositions);
  const { data: assignments } = useAssignmentsQuery(initialAssignments);
  const { data: availableRoles } = useRolesQuery(initialRoles);
  const { data: branches } = useBranchesQuery(initialBranches);

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

  // Position assign dialog
  const [assignPositionMember, setAssignPositionMember] = useState<OrgMember | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");

  // Role assign dialog
  const [assignRoleMember, setAssignRoleMember] = useState<OrgMember | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleScopeConfigs, setRoleScopeConfigs] = useState<Map<string, RoleScopeConfig>>(new Map());

  const canManage = can(MEMBERS_MANAGE);

  // Position map: userId → assignment
  const positionByUser = new Map(
    assignments.filter((a) => !a.deleted_at).map((a) => [a.user_id, a])
  );

  // Branch name lookup for role badge display
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));

  const handleStatusToggle = (member: OrgMember) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    statusMutation.mutate(
      { userId: member.user_id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Member ${newStatus === "active" ? "activated" : "deactivated"}`);
          router.refresh();
        },
      }
    );
  };

  const handleRemove = (member: OrgMember) => {
    removeMutation.mutate({ userId: member.user_id }, { onSuccess: () => router.refresh() });
  };

  // Position assignment
  const openAssignPosition = (member: OrgMember) => {
    const existing = positionByUser.get(member.user_id);
    setSelectedPositionId(existing?.position_id ?? "");
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
      if (existing) {
        await removePositionMutation.mutateAsync({ assignmentId: existing.id });
      }
      if (selectedPositionId) {
        await assignPositionMutation.mutateAsync({
          userId: assignPositionMember.user_id,
          positionId: selectedPositionId,
        });
        toast.success("Position assigned");
      } else {
        toast.success("Position removed");
      }
      setAssignPositionMember(null);
      router.refresh();
    } catch {
      // error toast handled by hook's onError
      setAssignPositionMember(null);
    }
  };

  // Role assignment — scope-aware
  const openAssignRoles = (member: OrgMember) => {
    // Unique role IDs (same role may be assigned to multiple branches)
    const uniqueRoleIds = [...new Set(member.roles.map((r) => r.id))];
    setSelectedRoleIds(uniqueRoleIds);

    // Initialize scope configs from actual assignment data (org + branch)
    const initConfigs = new Map<string, RoleScopeConfig>();
    for (const roleEntry of member.roles) {
      const existing = initConfigs.get(roleEntry.id);
      if (roleEntry.scope === "branch") {
        initConfigs.set(roleEntry.id, {
          scope: "branch",
          branchIds: [...(existing?.branchIds ?? []), roleEntry.scope_id],
        });
      } else if (!existing) {
        initConfigs.set(roleEntry.id, { scope: "org", branchIds: [] });
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
      } else {
        // Add with default scope config
        const defaultScope: "org" | "branch" = scopeType === "branch" ? "branch" : "org";
        setRoleScopeConfigs((cfg) => {
          const next = new Map(cfg);
          next.set(roleId, { scope: defaultScope, branchIds: [] });
          return next;
        });
        return [...prev, roleId];
      }
    });
  };

  const setRoleScope = (roleId: string, scope: "org" | "branch") => {
    setRoleScopeConfigs((prev) => {
      const next = new Map(prev);
      const existing = next.get(roleId) ?? { scope: "org", branchIds: [] };
      next.set(roleId, {
        ...existing,
        scope,
        branchIds: scope === "org" ? [] : existing.branchIds,
      });
      return next;
    });
  };

  const toggleBranchForRole = (roleId: string, branchId: string) => {
    setRoleScopeConfigs((prev) => {
      const next = new Map(prev);
      const existing = next.get(roleId) ?? { scope: "branch", branchIds: [] };
      const hasBranch = existing.branchIds.includes(branchId);
      next.set(roleId, {
        ...existing,
        branchIds: hasBranch
          ? existing.branchIds.filter((id) => id !== branchId)
          : [...existing.branchIds, branchId],
      });
      return next;
    });
  };

  const handleSaveRoles = async () => {
    if (!assignRoleMember) return;
    // All unique role IDs currently assigned (org + branch)
    const currentRoleIds = [...new Set(assignRoleMember.roles.map((r) => r.id))];
    // Roles unchecked — remove ALL their assignments
    const toRemoveRoles = currentRoleIds.filter((id) => !selectedRoleIds.includes(id));
    // Roles newly checked — create fresh assignments
    const toAddRoles = selectedRoleIds.filter((id) => !currentRoleIds.includes(id));
    // Roles that stay selected — reconcile scope/branch changes
    const toUpdateRoles = selectedRoleIds.filter((id) => currentRoleIds.includes(id));

    let changed = toAddRoles.length > 0 || toRemoveRoles.length > 0;

    try {
      // Remove all assignments for unchecked roles (by actual scope + scopeId)
      for (const roleId of toRemoveRoles) {
        const roleAssignments = assignRoleMember.roles.filter((r) => r.id === roleId);
        for (const assignment of roleAssignments) {
          await removeRoleMutation.mutateAsync({
            userId: assignRoleMember.user_id,
            roleId,
            scope: assignment.scope,
            scopeId: assignment.scope_id,
          });
        }
      }

      // Reconcile scope/branch changes for roles that remain selected
      for (const roleId of toUpdateRoles) {
        const config = roleScopeConfigs.get(roleId);
        if (!config) continue;

        const currentAssignments = assignRoleMember.roles.filter((r) => r.id === roleId);
        const currentOrgAssignment = currentAssignments.find((a) => a.scope === "org");
        const currentBranchScopeIds = currentAssignments
          .filter((a) => a.scope === "branch")
          .map((a) => a.scope_id);

        if (config.scope === "org") {
          // Desired: org-scoped — remove any branch assignments, ensure org assignment exists
          for (const branchId of currentBranchScopeIds) {
            changed = true;
            await removeRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId: branchId,
            });
          }
          if (!currentOrgAssignment) {
            changed = true;
            await assignRoleMutation.mutateAsync({ userId: assignRoleMember.user_id, roleId });
          }
        } else {
          // Desired: branch-scoped — remove org assignment if present, diff branches
          if (currentOrgAssignment) {
            changed = true;
            await removeRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "org",
              scopeId: currentOrgAssignment.scope_id,
            });
          }
          const branchesToAdd = config.branchIds.filter(
            (id) => !currentBranchScopeIds.includes(id)
          );
          const branchesToRemove = currentBranchScopeIds.filter(
            (id) => !config.branchIds.includes(id)
          );
          for (const branchId of branchesToRemove) {
            changed = true;
            await removeRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId: branchId,
            });
          }
          for (const branchId of branchesToAdd) {
            changed = true;
            await assignRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId: branchId,
            });
          }
        }
      }

      // Add new role assignments
      for (const roleId of toAddRoles) {
        const config = roleScopeConfigs.get(roleId);
        if (!config) continue;

        if (config.scope === "branch") {
          if (config.branchIds.length === 0) continue; // skip if no branch selected
          for (const scopeId of config.branchIds) {
            await assignRoleMutation.mutateAsync({
              userId: assignRoleMember.user_id,
              roleId,
              scope: "branch",
              scopeId,
            });
          }
        } else {
          await assignRoleMutation.mutateAsync({ userId: assignRoleMember.user_id, roleId });
        }
      }

      if (changed) toast.success("Roles updated");
      setAssignRoleMember(null);
      router.refresh();
    } catch {
      // error toast handled by hook's onError
      setAssignRoleMember(null);
    }
  };

  const getInitials = (m: OrgMember) => {
    if (m.user_first_name && m.user_last_name) {
      return `${m.user_first_name[0]}${m.user_last_name[0]}`.toUpperCase();
    }
    return (m.user_email ?? "?")[0].toUpperCase();
  };

  if (members.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No members found.</div>;
  }

  return (
    <>
      <div className="space-y-2">
        {members.map((member) => {
          const posAssignment = positionByUser.get(member.user_id);

          // Group roles for badge display — collect branch names for branch-scoped entries
          const roleBadgeMap = new Map<
            string,
            { id: string; name: string; scope: string; branchNames: string[] }
          >();
          for (const r of member.roles) {
            const existing = roleBadgeMap.get(r.id);
            if (existing) {
              if (r.scope === "branch") {
                const bName = branchNameMap.get(r.scope_id);
                if (bName) existing.branchNames.push(bName);
              }
            } else {
              roleBadgeMap.set(r.id, {
                id: r.id,
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
          const roleList = [...roleBadgeMap.values()];

          return (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.user_avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{getInitials(member)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {member.user_first_name || member.user_last_name
                      ? `${member.user_first_name ?? ""} ${member.user_last_name ?? ""}`.trim()
                      : (member.user_email ?? "Unknown")}
                  </p>
                  {(member.user_first_name || member.user_last_name) && (
                    <p className="text-xs text-muted-foreground">{member.user_email}</p>
                  )}
                  {(roleList.length > 0 || posAssignment?.position_name) && (
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {roleList.map((role) => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                          className="text-xs gap-1 py-0 max-w-xs"
                        >
                          <Shield className="h-2.5 w-2.5 shrink-0" />
                          <span>{role.name}</span>
                          {role.scope === "branch" && role.branchNames.length > 0 && (
                            <span className="opacity-60 font-normal truncate">
                              · {role.branchNames.join(", ")}
                            </span>
                          )}
                        </Badge>
                      ))}
                      {posAssignment?.position_name && (
                        <Badge variant="outline" className="text-xs gap-1 py-0">
                          <Briefcase className="h-2.5 w-2.5" />
                          {posAssignment.position_name}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={member.status === "active" ? "default" : "secondary"}>
                  {member.status}
                </Badge>
                <Link
                  href={{
                    pathname: "/dashboard/organization/users/members/[memberId]",
                    params: { memberId: member.user_id },
                  }}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="View member details"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleStatusToggle(member)}>
                        {member.status === "active" ? (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAssignRoles(member)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Manage Roles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAssignPosition(member)}>
                        <Briefcase className="h-4 w-4 mr-2" />
                        {posAssignment ? "Change Position" : "Assign Position"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleRemove(member)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manage Roles Dialog — scope-aware */}
      <Dialog
        open={assignRoleMember !== null}
        onOpenChange={(open) => !open && setAssignRoleMember(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 max-h-80 overflow-y-auto pr-1">
            {availableRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles available.</p>
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
                              system
                            </Badge>
                          )}
                          {role.scope_type === "branch" && (
                            <Badge
                              variant="outline"
                              className="text-xs gap-1 py-0 text-blue-600 border-blue-300"
                            >
                              <GitBranch className="h-2.5 w-2.5" />
                              branch
                            </Badge>
                          )}
                          {role.scope_type === "both" && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 text-purple-600 border-purple-300"
                            >
                              both
                            </Badge>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        )}
                      </Label>
                    </div>

                    {/* Scope toggle for 'both' roles */}
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
                          Org
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={config?.scope === "branch" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setRoleScope(role.id, "branch")}
                          disabled={isPending}
                        >
                          Branch
                        </Button>
                      </div>
                    )}

                    {/* Branch multiselect for branch-scoped roles */}
                    {showBranchSelector && (
                      <div className="ml-7 space-y-1">
                        {branches.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No branches available.</p>
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
                          <p className="text-xs text-amber-600">Select at least one branch.</p>
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
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Position Dialog */}
      <Dialog
        open={assignPositionMember !== null}
        onOpenChange={(open) => !open && setAssignPositionMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {positionByUser.get(assignPositionMember?.user_id ?? "")
                ? "Change Position"
                : "Assign Position"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedPositionId} onValueChange={setSelectedPositionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a position…" />
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
                Leave unselected to remove the current position.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignPositionMember(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignPosition} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
