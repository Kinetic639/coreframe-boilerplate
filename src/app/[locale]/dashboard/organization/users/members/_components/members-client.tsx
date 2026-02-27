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
import { MoreHorizontal, UserCheck, UserX, Trash2, Briefcase, Shield } from "lucide-react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { MEMBERS_MANAGE } from "@/lib/constants/permissions";
import {
  useMembersQuery,
  usePositionsQuery,
  useAssignmentsQuery,
  useRolesQuery,
  useUpdateMemberStatusMutation,
  useRemoveMemberMutation,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAssignPositionMutation,
  useRemovePositionAssignmentMutation,
} from "@/hooks/queries/organization";
import type {
  OrgMember,
  OrgPosition,
  OrgPositionAssignment,
  OrgRole,
} from "@/server/services/organization.service";

interface MembersClientProps {
  initialMembers: OrgMember[];
  initialPositions: OrgPosition[];
  initialAssignments: OrgPositionAssignment[];
  initialRoles: OrgRole[];
}

export function MembersClient({
  initialMembers,
  initialPositions,
  initialAssignments,
  initialRoles,
}: MembersClientProps) {
  const router = useRouter();
  const { can } = usePermissions();

  const { data: members } = useMembersQuery(initialMembers);
  const { data: positions } = usePositionsQuery(initialPositions);
  const { data: assignments } = useAssignmentsQuery(initialAssignments);
  const { data: availableRoles } = useRolesQuery(initialRoles);

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

  const canManage = can(MEMBERS_MANAGE);

  // Position map: userId → assignment
  const positionByUser = new Map(
    assignments.filter((a) => !a.deleted_at).map((a) => [a.user_id, a])
  );

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

  // Role assignment
  const openAssignRoles = (member: OrgMember) => {
    setSelectedRoleIds(member.roles.map((r) => r.id));
    setAssignRoleMember(member);
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSaveRoles = async () => {
    if (!assignRoleMember) return;
    const currentIds = assignRoleMember.roles.map((r) => r.id);
    const toAdd = selectedRoleIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !selectedRoleIds.includes(id));
    try {
      for (const roleId of toAdd) {
        await assignRoleMutation.mutateAsync({ userId: assignRoleMember.user_id, roleId });
      }
      for (const roleId of toRemove) {
        await removeRoleMutation.mutateAsync({ userId: assignRoleMember.user_id, roleId });
      }
      if (toAdd.length > 0 || toRemove.length > 0) toast.success("Roles updated");
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
                  {(member.roles.length > 0 || posAssignment?.position_name) && (
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {member.roles.map((role) => (
                        <Badge key={role.id} variant="secondary" className="text-xs gap-1 py-0">
                          <Shield className="h-2.5 w-2.5" />
                          {role.name}
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

      {/* Manage Roles Dialog */}
      <Dialog
        open={assignRoleMember !== null}
        onOpenChange={(open) => !open && setAssignRoleMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 max-h-64 overflow-y-auto">
            {availableRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles available.</p>
            ) : (
              availableRoles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoleIds.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                    disabled={isPending}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`role-${role.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{role.name}</span>
                      {role.is_basic && (
                        <Badge variant="secondary" className="text-xs">
                          system
                        </Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    )}
                  </Label>
                </div>
              ))
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
