"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Plus, Pencil, Trash2, Lock, Building2, GitBranch } from "lucide-react";
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
// allowedScopes: which role scope_types may include this permission.
//   "org"    → org-level concern only (org profile, branch CRUD)
//   "branch" → relevant when assigned at branch scope (member ops, invites, read-only branch info)
const PERMISSION_GROUPS = [
  {
    label: "Organization",
    permissions: [
      {
        slug: ORG_READ,
        label: "View organization profile",
        allowedScopes: ["org"] as ("org" | "branch")[],
      },
      {
        slug: ORG_UPDATE,
        label: "Edit organization profile & logo",
        allowedScopes: ["org"] as ("org" | "branch")[],
      },
    ],
  },
  {
    label: "Members",
    permissions: [
      {
        slug: MEMBERS_READ,
        label: "View members list",
        allowedScopes: ["org", "branch"] as ("org" | "branch")[],
      },
      {
        slug: MEMBERS_MANAGE,
        label: "Manage members (activate, remove, assign roles & positions)",
        allowedScopes: ["org", "branch"] as ("org" | "branch")[],
      },
    ],
  },
  {
    label: "Invitations",
    permissions: [
      {
        slug: INVITES_READ,
        label: "View invitations",
        allowedScopes: ["org", "branch"] as ("org" | "branch")[],
      },
      {
        slug: INVITES_CREATE,
        label: "Send invitations",
        allowedScopes: ["org", "branch"] as ("org" | "branch")[],
      },
      {
        slug: INVITES_CANCEL,
        label: "Cancel invitations",
        allowedScopes: ["org", "branch"] as ("org" | "branch")[],
      },
    ],
  },
  {
    label: "Branches",
    permissions: [
      {
        slug: BRANCHES_READ,
        label: "View branches",
        allowedScopes: ["org", "branch"] as ("org" | "branch")[],
      },
      {
        slug: BRANCHES_CREATE,
        label: "Create branches",
        allowedScopes: ["org"] as ("org" | "branch")[],
      },
      {
        slug: BRANCHES_UPDATE,
        label: "Edit branches",
        allowedScopes: ["org"] as ("org" | "branch")[],
      },
      {
        slug: BRANCHES_DELETE,
        label: "Delete branches",
        allowedScopes: ["org"] as ("org" | "branch")[],
      },
    ],
  },
];

function ScopeBadge({ scopeType, tBadge }: { scopeType: string; tBadge: (k: string) => string }) {
  if (scopeType === "branch") {
    return (
      <Badge variant="outline" className="text-xs gap-1 py-0 text-blue-600 border-blue-300">
        <GitBranch className="h-2.5 w-2.5" />
        {tBadge("branch")}
      </Badge>
    );
  }
  if (scopeType === "both") {
    return (
      <Badge variant="outline" className="text-xs gap-1 py-0 text-purple-600 border-purple-300">
        <Building2 className="h-2.5 w-2.5" />
        {tBadge("both")}
      </Badge>
    );
  }
  return null; // 'org' is the default — no badge needed
}

export function RolesClient({ initialRoles }: RolesClientProps) {
  const t = useTranslations("modules.organizationManagement.roles");
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
  const [scopeType, setScopeType] = useState<"org" | "branch">("org");

  const canManage = can(MEMBERS_MANAGE);

  const openCreate = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPerms([]);
    setScopeType("org");
    setDialogMode("create");
  };

  const openEdit = (role: OrgRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? "");
    setSelectedPerms(role.permission_slugs ?? []);
    // scope_type is read-only in edit — just reflect what's stored
    setDialogMode("edit");
  };

  const togglePerm = (slug: string) => {
    setSelectedPerms((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // P2: when scope changes in create mode, drop any selected perms that are now disallowed
  const handleScopeChange = (v: "org" | "branch") => {
    setScopeType(v);
    if (v === "branch") {
      const branchAllowed = new Set<string>(
        PERMISSION_GROUPS.flatMap((g) =>
          g.permissions.filter((p) => p.allowedScopes.includes("branch")).map((p) => p.slug)
        )
      );
      setSelectedPerms((prev) => prev.filter((s) => branchAllowed.has(s)));
    }
  };

  const handleSubmit = () => {
    if (!roleName.trim()) return;
    if (dialogMode === "create") {
      createMutation.mutate(
        {
          name: roleName.trim(),
          description: roleDesc || null,
          permission_slugs: selectedPerms,
          scope_type: scopeType,
        },
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
            {t("createButton")}
          </Button>
        </div>
      )}

      {roles.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t("noRoles")}</div>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{role.name}</p>
                    {role.is_basic && (
                      <Badge variant="secondary" className="text-xs">
                        {t("systemBadge")}
                      </Badge>
                    )}
                    <ScopeBadge scopeType={role.scope_type} tBadge={(k) => t(`scopeBadges.${k}`)} />
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? t("dialog.titleCreate") : t("dialog.titleEdit")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto max-h-[60vh] px-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">{t("dialog.name")}</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder={t("dialog.namePlaceholder")}
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">{t("dialog.description")}</Label>
              <Textarea
                id="role-desc"
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder={t("dialog.descriptionPlaceholder")}
                maxLength={500}
                rows={2}
                disabled={isPending}
              />
            </div>
            {/* Scope selector — only for create; read-only in edit */}
            {dialogMode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="role-scope">{t("dialog.scope")}</Label>
                <Select
                  value={scopeType}
                  onValueChange={(v) => handleScopeChange(v as "org" | "branch")}
                  disabled={isPending}
                >
                  <SelectTrigger id="role-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">{t("dialog.scopeOrg")}</SelectItem>
                    <SelectItem value="branch">{t("dialog.scopeBranch")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("dialog.scopeNote")}</p>
              </div>
            ) : (
              editingRole && (
                <div className="space-y-1">
                  <Label>{t("dialog.scope")}</Label>
                  <div className="flex items-center gap-2">
                    <ScopeBadge
                      scopeType={editingRole.scope_type}
                      tBadge={(k) => t(`scopeBadges.${k}`)}
                    />
                    {editingRole.scope_type === "org" && (
                      <span className="text-sm text-muted-foreground">
                        {t("dialog.scopeOrg").split("—")[0].trim()}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {t("dialog.scopeReadOnly")}
                    </span>
                  </div>
                </div>
              )
            )}
            <div className="space-y-3">
              <Label>{t("dialog.permissions")}</Label>
              {/* P2: in create mode, only show permissions valid for the selected scope */}
              {(() => {
                const visibleGroups = PERMISSION_GROUPS.map((g) => ({
                  ...g,
                  permissions:
                    dialogMode === "create"
                      ? g.permissions.filter((p) => p.allowedScopes.includes(scopeType))
                      : g.permissions,
                })).filter((g) => g.permissions.length > 0);

                return (
                  <div className="divide-y rounded-md border">
                    {visibleGroups.map((group) => (
                      <div key={group.label} className="flex flex-col gap-3 p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </p>
                        <div className="space-y-3">
                          {group.permissions.map((perm) => (
                            <div key={perm.slug} className="flex items-center gap-3">
                              <Checkbox
                                id={`perm-${perm.slug}`}
                                checked={selectedPerms.includes(perm.slug)}
                                onCheckedChange={() => togglePerm(perm.slug)}
                                disabled={isPending}
                                className="shrink-0"
                              />
                              <Label
                                htmlFor={`perm-${perm.slug}`}
                                className="flex-1 flex items-center justify-between gap-4 cursor-pointer font-normal text-sm"
                              >
                                <span>{perm.label}</span>
                                <span className="text-xs text-muted-foreground font-mono shrink-0">
                                  {perm.slug}
                                </span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {selectedPerms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("dialog.permissionsSelected", { count: selectedPerms.length })}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
              {t("dialog.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !roleName.trim()}>
              {isPending
                ? t("dialog.saving")
                : dialogMode === "create"
                  ? t("dialog.create")
                  : t("dialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
