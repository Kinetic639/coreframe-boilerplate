"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Label } from "@/components/ui/label";
import { GitBranch, Shield, UserMinus, UserPlus } from "lucide-react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import {
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
} from "@/hooks/queries/organization";
import type { BranchMemberGroup, OrgMember, OrgRole } from "@/server/services/organization.service";

interface BranchAccessClientProps {
  initialGroups: BranchMemberGroup[];
  availableRoles: OrgRole[];
  canOrgAdmin: boolean;
}

function getMemberInitials(m: OrgMember): string {
  if (m.user_first_name && m.user_last_name) {
    return `${m.user_first_name[0]}${m.user_last_name[0]}`.toUpperCase();
  }
  return (m.user_email ?? "?")[0].toUpperCase();
}

function getMemberDisplayName(m: OrgMember): string {
  if (m.user_first_name || m.user_last_name) {
    return `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim();
  }
  return m.user_email ?? "Unknown";
}

interface AssignDialogState {
  member: OrgMember;
  branchId: string;
  branchName: string | null;
}

export function BranchAccessClient({
  initialGroups,
  availableRoles,
  canOrgAdmin,
}: BranchAccessClientProps) {
  const router = useRouter();
  const [assignState, setAssignState] = useState<AssignDialogState | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const assignMutation = useAssignRoleToUserMutation();
  const removeMutation = useRemoveRoleFromUserMutation();

  const isPending = assignMutation.isPending || removeMutation.isPending;

  const openAssignDialog = (member: OrgMember, branchId: string, branchName: string | null) => {
    setSelectedRoleId("");
    setAssignState({ member, branchId, branchName });
  };

  const handleAssign = async () => {
    if (!assignState || !selectedRoleId) return;
    try {
      await assignMutation.mutateAsync({
        userId: assignState.member.user_id,
        roleId: selectedRoleId,
        scope: "branch",
        scopeId: assignState.branchId,
      });
      toast.success("Role assigned");
      setAssignState(null);
      router.refresh();
    } catch {
      // error toast handled by mutation's onError
    }
  };

  const handleRemove = async (member: OrgMember, roleId: string, branchId: string) => {
    try {
      await removeMutation.mutateAsync({
        userId: member.user_id,
        roleId,
        scope: "branch",
        scopeId: branchId,
      });
      toast.success("Role removed");
      router.refresh();
    } catch {
      // error toast handled by mutation's onError
    }
  };

  if (initialGroups.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No branch member assignments found.
        {!canOrgAdmin && (
          <p className="mt-1 text-xs">
            You can only see branches where you have role management access.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {initialGroups.map((group) => {
          if (!group.branchId) return null; // skip unassigned group in branch manager view
          return (
            <div key={group.branchId} className="rounded-lg border">
              {/* Branch header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/40">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{group.branchName ?? group.branchId}</span>
                <Badge variant="secondary" className="text-xs">
                  {group.members.length} {group.members.length === 1 ? "member" : "members"}
                </Badge>
              </div>

              {/* Members in this branch */}
              <div className="divide-y">
                {group.members.map((member) => {
                  // Branch-scoped role assignments for this specific branch
                  const branchRoles = member.roles.filter(
                    (r) => r.scope === "branch" && r.scope_id === group.branchId
                  );

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user_avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getMemberInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{getMemberDisplayName(member)}</p>
                          {member.user_email &&
                            (member.user_first_name || member.user_last_name) && (
                              <p className="text-xs text-muted-foreground">{member.user_email}</p>
                            )}
                          {branchRoles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {branchRoles.map((r) => (
                                <Badge
                                  key={r.id}
                                  variant="outline"
                                  className="text-xs gap-1 py-0 text-blue-600 border-blue-300 group cursor-default"
                                >
                                  <Shield className="h-2.5 w-2.5 shrink-0" />
                                  {r.name}
                                  <button
                                    type="button"
                                    className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 hover:text-destructive transition-opacity"
                                    onClick={() => handleRemove(member, r.id, group.branchId!)}
                                    disabled={isPending}
                                    title="Remove role"
                                  >
                                    <UserMinus className="h-2.5 w-2.5" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => openAssignDialog(member, group.branchId!, group.branchName)}
                        disabled={isPending || availableRoles.length === 0}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign role
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={assignState !== null} onOpenChange={(open) => !open && setAssignState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Branch Role</DialogTitle>
          </DialogHeader>
          {assignState && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                Assigning to{" "}
                <span className="font-medium">{getMemberDisplayName(assignState.member)}</span> in
                branch{" "}
                <span className="font-medium">
                  {assignState.branchName ?? assignState.branchId}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableRoles.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No branch-scoped roles available. Ask an org admin to create one.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignState(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={isPending || !selectedRoleId}>
              {isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
