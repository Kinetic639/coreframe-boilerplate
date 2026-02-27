"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/v2/use-permissions";
import {
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
  MEMBERS_MANAGE,
  INVITES_READ,
  INVITES_CREATE,
  INVITES_CANCEL,
  BRANCHES_READ,
  BRANCHES_CREATE,
  BRANCHES_UPDATE,
  BRANCHES_DELETE,
} from "@/lib/constants/permissions";
import {
  useRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from "@/hooks/queries/organization";
import type { OrgRole } from "@/server/services/organization.service";

interface RolesClientProps {
  initialRoles: OrgRole[];
}

type DialogMode = "create" | "edit" | null;

// Org-scoped permissions available for custom roles.
// Slugs come from imported constants — no raw strings.
const PERMISSION_GROUPS = [
  {
    label: "Organization",
    permissions: [
      { slug: ORG_READ, label: "View organization profile" },
      { slug: ORG_UPDATE, label: "Edit organization profile & logo" },
    ],
  },
  {
    label: "Members",
    permissions: [
      { slug: MEMBERS_READ, label: "View members list" },
      {
        slug: MEMBERS_MANAGE,
        label: "Manage members (activate, remove, assign roles & positions)",
      },
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

export function RolesClient({ initialRoles }: RolesClientProps) {
  const router = useRouter();
  const { can } = usePermissions();

  const { data: roles } = useRolesQuery(initialRoles);
  const createMutation = useCreateRoleMutation();
  const updateMutation = useUpdateRoleMutation();
  const deleteMutation = useDeleteRoleMutation();

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const canManage = can(MEMBERS_MANAGE);

  const openCreate = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPerms([]);
    setDialogMode("create");
  };

  const openEdit = (role: OrgRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? "");
    setSelectedPerms(role.permission_slugs ?? []);
    setDialogMode("edit");
  };

  const togglePerm = (slug: string) => {
    setSelectedPerms((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSubmit = () => {
    if (!roleName.trim()) return;
    if (dialogMode === "create") {
      createMutation.mutate(
        { name: roleName.trim(), description: roleDesc || null, permission_slugs: selectedPerms },
        {
          onSuccess: () => {
            setDialogMode(null);
            router.refresh();
          },
        }
      );
    } else if (dialogMode === "edit" && editingRole) {
      updateMutation.mutate(
        {
          roleId: editingRole.id,
          name: roleName.trim(),
          description: roleDesc || null,
          permission_slugs: selectedPerms,
        },
        {
          onSuccess: () => {
            setDialogMode(null);
            router.refresh();
          },
        }
      );
    }
  };

  const handleDelete = (role: OrgRole) => {
    deleteMutation.mutate({ roleId: role.id }, { onSuccess: () => router.refresh() });
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      )}

      {roles.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No roles found.</div>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {role.is_basic ? (
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{role.name}</p>
                    {role.is_basic && (
                      <Badge variant="secondary" className="text-xs">
                        system
                      </Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  )}
                  {role.permission_slugs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {role.permission_slugs.map((slug) => (
                        <Badge key={slug} variant="outline" className="text-xs py-0 font-mono">
                          {slug}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {canManage && !role.is_basic && (
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(role)}
                    disabled={isPending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(role)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Create Role" : "Edit Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Role name"
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
                rows={2}
                disabled={isPending}
              />
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="max-h-64 overflow-y-auto space-y-4 rounded-md border p-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {group.label}
                    </p>
                    <div className="space-y-1.5">
                      {group.permissions.map((perm) => (
                        <div key={perm.slug} className="flex items-start gap-2.5">
                          <Checkbox
                            id={`perm-${perm.slug}`}
                            checked={selectedPerms.includes(perm.slug)}
                            onCheckedChange={() => togglePerm(perm.slug)}
                            disabled={isPending}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`perm-${perm.slug}`}
                            className="cursor-pointer font-normal leading-snug"
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
              {selectedPerms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedPerms.length} permission{selectedPerms.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !roleName.trim()}>
              {isPending ? "Saving…" : dialogMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
