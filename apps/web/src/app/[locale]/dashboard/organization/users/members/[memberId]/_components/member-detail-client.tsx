"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Shield,
  Trash2,
  Plus,
  GitBranch,
  Building2,
  ChevronLeft,
  UserCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/v2/use-permissions";
import {
  MEMBERS_MANAGE,
  MEMBERS_READ,
  ORG_READ,
  ORG_UPDATE,
  INVITES_READ,
  INVITES_CREATE,
  INVITES_CANCEL,
  BRANCHES_READ,
  BRANCHES_CREATE,
  BRANCHES_UPDATE,
  BRANCHES_DELETE,
} from "@/lib/constants/permissions";
import {
  useMemberAccessQuery,
  useRolesQuery,
  useBranchesQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useCreateRoleMutation,
} from "@/hooks/queries/organization";
import type {
  OrgMember,
  OrgMemberAccess,
  OrgRoleAssignment,
  OrgRole,
  OrgBranch,
} from "@/server/services/organization.service";

interface MemberDetailClientProps {
  member: OrgMember;
  initialAccess: OrgMemberAccess;
  initialRoles: OrgRole[];
  initialBranches: OrgBranch[];
}

function ScopeBadge({ assignment }: { assignment: OrgRoleAssignment }) {
  if (assignment.scope === "branch") {
    return (
      <Badge variant="outline" className="text-xs gap-1 py-0 text-blue-600 border-blue-300">
        <GitBranch className="h-2.5 w-2.5" />
        {assignment.branch_name ?? "branch"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 py-0 text-muted-foreground">
      <Building2 className="h-2.5 w-2.5" />
      org
    </Badge>
  );
}

export function MemberDetailClient({
  member,
  initialAccess,
  initialRoles,
  initialBranches,
}: MemberDetailClientProps) {
  const router = useRouter();
  const { can } = usePermissions();

  const { data: access } = useMemberAccessQuery(member.user_id, initialAccess);
  const { data: availableRoles } = useRolesQuery(initialRoles);
  const { data: branches } = useBranchesQuery(initialBranches);

  const assignRoleMutation = useAssignRoleToUserMutation();
  const removeRoleMutation = useRemoveRoleFromUserMutation();
  const createRoleMutation = useCreateRoleMutation();

  const canManage = can(MEMBERS_MANAGE);
  const canRead = can(MEMBERS_READ);

  const isPending =
    assignRoleMutation.isPending || removeRoleMutation.isPending || createRoleMutation.isPending;

  // Add role dialog state
  const [showAddRole, setShowAddRole] = useState(false);
  const [addRoleId, setAddRoleId] = useState<string>("");
  const [addRoleScope, setAddRoleScope] = useState<"org" | "branch">("org");
  const [addRoleBranchId, setAddRoleBranchId] = useState<string>("");

  // Custom access dialog state
  const [showCustomAccess, setShowCustomAccess] = useState(false);
  const [customPerms, setCustomPerms] = useState<string[]>([]);
  const [customRoleName] = useState(
    `Custom: ${[member.user_first_name, member.user_last_name].filter(Boolean).join(" ") || member.user_email || "Member"}`
  );

  const displayName =
    [member.user_first_name, member.user_last_name].filter(Boolean).join(" ") ||
    member.user_email ||
    "Unknown";

  const getInitials = () => {
    if (member.user_first_name && member.user_last_name) {
      return `${member.user_first_name[0]}${member.user_last_name[0]}`.toUpperCase();
    }
    return (member.user_email ?? "?")[0].toUpperCase();
  };

  const handleRemoveAssignment = async (assignment: OrgRoleAssignment) => {
    try {
      await removeRoleMutation.mutateAsync({
        userId: member.user_id,
        roleId: assignment.role_id,
        scope: assignment.scope as "org" | "branch",
        scopeId: assignment.scope_id,
      });
      toast.success("Role removed");
      router.refresh();
    } catch {
      // error toast handled by hook's onError
    }
  };

  const selectedAddRole = availableRoles.find((r) => r.id === addRoleId);

  const handleAddRole = async () => {
    if (!addRoleId) return;
    const role = selectedAddRole;
    if (!role) return;

    const effectiveScope =
      role.scope_type === "org" ? "org" : role.scope_type === "branch" ? "branch" : addRoleScope;

    if (effectiveScope === "branch" && !addRoleBranchId) {
      toast.error("Select a branch");
      return;
    }

    try {
      await assignRoleMutation.mutateAsync({
        userId: member.user_id,
        roleId: addRoleId,
        scope: effectiveScope,
        scopeId: effectiveScope === "branch" ? addRoleBranchId : undefined,
      });
      toast.success("Role assigned");
      setShowAddRole(false);
      setAddRoleId("");
      setAddRoleBranchId("");
      router.refresh();
    } catch {
      // error toast handled by hook's onError
    }
  };

  const handleSaveCustomAccess = async () => {
    if (customPerms.length === 0) {
      toast.error("Select at least one permission");
      return;
    }
    try {
      const newRole = await createRoleMutation.mutateAsync({
        name: customRoleName,
        permission_slugs: customPerms,
        scope_type: "org",
      });
      await assignRoleMutation.mutateAsync({
        userId: member.user_id,
        roleId: newRole.id,
      });
      toast.success("Custom access granted");
      setShowCustomAccess(false);
      setCustomPerms([]);
      router.refresh();
    } catch {
      // error toast handled by mutation's onError
    }
  };

  const toggleCustomPerm = (slug: string) => {
    setCustomPerms((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // Permissions available for custom access — grouped, no raw strings.
  // Custom access always creates an org-scoped role, so all org permissions are valid.
  const CUSTOM_ACCESS_PERM_GROUPS = [
    {
      label: "Organization",
      permissions: [
        { slug: ORG_READ, label: "View organization profile" },
        { slug: ORG_UPDATE, label: "Edit organization profile" },
      ],
    },
    {
      label: "Members",
      permissions: [
        { slug: MEMBERS_READ, label: "View members" },
        { slug: MEMBERS_MANAGE, label: "Manage members" },
      ],
    },
    {
      label: "Invitations",
      permissions: [
        { slug: INVITES_READ, label: "View invitations" },
        { slug: INVITES_CREATE, label: "Send invitations" },
        { slug: INVITES_CANCEL, label: "Cancel invitations" },
      ],
    },
    {
      label: "Branches",
      permissions: [
        { slug: BRANCHES_READ, label: "View branches" },
        { slug: BRANCHES_CREATE, label: "Create branches" },
        { slug: BRANCHES_UPDATE, label: "Edit branches" },
        { slug: BRANCHES_DELETE, label: "Delete branches" },
      ],
    },
  ];

  if (!canRead) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Unauthorized.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/dashboard/organization/users/members"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to members
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={member.user_avatar_url ?? undefined} />
          <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-semibold">{displayName}</h2>
          {member.user_email && member.user_first_name && (
            <p className="text-sm text-muted-foreground">{member.user_email}</p>
          )}
          <Badge variant={member.status === "active" ? "default" : "secondary"} className="mt-1">
            {member.status}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="info">
            <UserCircle className="h-4 w-4 mr-1.5" />
            Info
          </TabsTrigger>
          <TabsTrigger value="access">
            <Shield className="h-4 w-4 mr-1.5" />
            Access
          </TabsTrigger>
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info" className="mt-4 space-y-3">
          <div className="rounded-lg border divide-y">
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{member.user_email ?? "—"}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={member.status === "active" ? "default" : "secondary"}>
                {member.status}
              </Badge>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Joined</span>
              <span className="text-sm font-medium">
                {member.joined_at
                  ? new Date(member.joined_at).toLocaleDateString()
                  : member.created_at
                    ? new Date(member.created_at).toLocaleDateString()
                    : "—"}
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Access tab */}
        <TabsContent value="access" className="mt-4 space-y-4">
          {canManage && (
            <div className="flex gap-2 justify-end flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCustomAccess(true)}
                disabled={isPending}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Custom Access
              </Button>
              <Button size="sm" onClick={() => setShowAddRole(true)} disabled={isPending}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Role
              </Button>
            </div>
          )}

          {!access?.assignments || access.assignments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No role assignments found.
            </div>
          ) : (
            <div className="space-y-2">
              {access.assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{assignment.role_name}</p>
                        {assignment.role_is_basic && (
                          <Badge variant="secondary" className="text-xs">
                            system
                          </Badge>
                        )}
                        <ScopeBadge assignment={assignment} />
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRemoveAssignment(assignment)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Role Dialog */}
      <Dialog open={showAddRole} onOpenChange={(open) => !open && setShowAddRole(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {availableRoles.map((role) => (
                  <div
                    key={role.id}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50 ${
                      addRoleId === role.id ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      setAddRoleId(role.id);
                      setAddRoleScope(role.scope_type === "branch" ? "branch" : "org");
                      setAddRoleBranchId("");
                    }}
                  >
                    <div
                      className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
                        addRoleId === role.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    />
                    <span className="text-sm">{role.name}</span>
                    {role.scope_type === "branch" && (
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 py-0 ml-auto text-blue-600 border-blue-300"
                      >
                        <GitBranch className="h-2.5 w-2.5" />
                        branch
                      </Badge>
                    )}
                    {role.scope_type === "both" && (
                      <Badge
                        variant="outline"
                        className="text-xs py-0 ml-auto text-purple-600 border-purple-300"
                      >
                        both
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Scope toggle for 'both' roles */}
            {selectedAddRole?.scope_type === "both" && (
              <div className="space-y-2">
                <Label>Assign scope</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={addRoleScope === "org" ? "default" : "outline"}
                    onClick={() => {
                      setAddRoleScope("org");
                      setAddRoleBranchId("");
                    }}
                    disabled={isPending}
                  >
                    Organization
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={addRoleScope === "branch" ? "default" : "outline"}
                    onClick={() => setAddRoleScope("branch")}
                    disabled={isPending}
                  >
                    Branch
                  </Button>
                </div>
              </div>
            )}

            {/* Branch selector */}
            {addRoleId &&
              (selectedAddRole?.scope_type === "branch" ||
                (selectedAddRole?.scope_type === "both" && addRoleScope === "branch")) && (
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <div className="space-y-1 max-h-36 overflow-y-auto rounded-md border p-2">
                    {branches.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-1">No branches available.</p>
                    ) : (
                      branches.map((branch) => (
                        <div
                          key={branch.id}
                          className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50 ${
                            addRoleBranchId === branch.id ? "bg-muted" : ""
                          }`}
                          onClick={() => setAddRoleBranchId(branch.id)}
                        >
                          <div
                            className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
                              addRoleBranchId === branch.id
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            }`}
                          />
                          <span className="text-sm">{branch.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRole(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleAddRole} disabled={isPending || !addRoleId}>
              {isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Access Dialog */}
      <Dialog open={showCustomAccess} onOpenChange={(open) => !open && setShowCustomAccess(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              Creates role <span className="font-medium">&ldquo;{customRoleName}&rdquo;</span> and
              assigns it to this member.
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="rounded-md border p-3 space-y-4">
                {CUSTOM_ACCESS_PERM_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {group.permissions.map((perm) => (
                        <div key={perm.slug} className="flex items-start gap-2.5">
                          <Checkbox
                            id={`cp-${perm.slug}`}
                            checked={customPerms.includes(perm.slug)}
                            onCheckedChange={() => toggleCustomPerm(perm.slug)}
                            disabled={isPending}
                            className="mt-0.5 shrink-0"
                          />
                          <Label
                            htmlFor={`cp-${perm.slug}`}
                            className="font-normal cursor-pointer leading-snug"
                          >
                            <span className="text-sm">{perm.label}</span>
                            <span className="block text-xs text-muted-foreground font-mono">
                              {perm.slug}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCustomAccess(false);
                setCustomPerms([]);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCustomAccess}
              disabled={isPending || customPerms.length === 0}
            >
              {isPending ? "Saving…" : "Grant Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
