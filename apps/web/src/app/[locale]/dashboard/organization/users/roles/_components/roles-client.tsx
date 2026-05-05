"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/v2/use-permissions";
import {
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
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
  BRANCH_ROLES_MANAGE,
} from "@/lib/constants/permissions";
import {
  useRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from "@/hooks/queries/organization";
import type { OrgRole } from "@/server/services/organization.service";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { filterSortRoles, paginateRoles } from "../_utils/data-view";

const ROLES_DV_KEY = ["org-roles-dataview"];

interface RolesClientProps {
  initialData: PaginatedResult<OrgRole>;
  allRoles: OrgRole[];
}

type DialogMode = "create" | "edit" | null;

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
  return null;
}

export function RolesClient({ initialData, allRoles: initialAllRoles }: RolesClientProps) {
  const t = useTranslations("modules.organizationManagement.roles");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const allRef = useRef(initialAllRoles);
  allRef.current = initialAllRoles;

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<OrgRole>> => {
      const filtered = filterSortRoles(allRef.current, params);
      return paginateRoles(filtered, params.page, params.pageSize);
    },
    []
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<OrgRole | null> => allRef.current.find((r) => r.id === id) ?? null,
    []
  );

  useRolesQuery(initialAllRoles);
  const createMutation = useCreateRoleMutation();
  const updateMutation = useUpdateRoleMutation();
  const deleteMutation = useDeleteRoleMutation();

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const canManage = can(MEMBERS_MANAGE);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [scopeType, setScopeType] = useState<"org" | "branch">("org");

  // Permission groups with translated labels — defined inside component so t() is available
  const permissionGroups = useMemo(
    () => [
      {
        label: t("permissionGroups.organization"),
        permissions: [
          {
            slug: ORG_READ,
            label: t("permissionGroups.permissions.orgRead"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
          {
            slug: ORG_UPDATE,
            label: t("permissionGroups.permissions.orgUpdate"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
        ],
      },
      {
        label: t("permissionGroups.members"),
        permissions: [
          {
            slug: MEMBERS_READ,
            label: t("permissionGroups.permissions.membersRead"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
          {
            slug: MEMBERS_MANAGE,
            label: t("permissionGroups.permissions.membersManage"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
        ],
      },
      {
        label: t("permissionGroups.invitations"),
        permissions: [
          {
            slug: INVITES_READ,
            label: t("permissionGroups.permissions.invitesRead"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
          {
            slug: INVITES_CREATE,
            label: t("permissionGroups.permissions.invitesCreate"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
          {
            slug: INVITES_CANCEL,
            label: t("permissionGroups.permissions.invitesCancel"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
        ],
      },
      {
        label: t("permissionGroups.branchManagement"),
        permissions: [
          {
            slug: BRANCH_ROLES_MANAGE,
            label: t("permissionGroups.permissions.branchRolesManage"),
            allowedScopes: ["branch"] as ("org" | "branch")[],
          },
        ],
      },
      {
        label: t("permissionGroups.branches"),
        permissions: [
          {
            slug: BRANCHES_READ,
            label: t("permissionGroups.permissions.branchesRead"),
            allowedScopes: ["org", "branch"] as ("org" | "branch")[],
          },
          {
            slug: BRANCHES_CREATE,
            label: t("permissionGroups.permissions.branchesCreate"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
          {
            slug: BRANCHES_UPDATE,
            label: t("permissionGroups.permissions.branchesUpdate"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
          {
            slug: BRANCHES_DELETE,
            label: t("permissionGroups.permissions.branchesDelete"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
        ],
      },
      {
        label: t("permissionGroups.moduleAccess"),
        permissions: [
          {
            slug: MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
            label: t("permissionGroups.permissions.moduleOrgManagementAccess"),
            allowedScopes: ["org"] as ("org" | "branch")[],
          },
        ],
      },
    ],
    [t]
  );

  const refreshAfterMutation = async () => {
    await queryClient.invalidateQueries({ queryKey: ROLES_DV_KEY });
    router.refresh();
  };

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
    const scopeFilter: "org" | "branch" | null =
      role.scope_type === "org" || role.scope_type === "branch" ? role.scope_type : null;
    const validSlugs = scopeFilter
      ? new Set<string>(
          permissionGroups.flatMap((g) =>
            g.permissions.filter((p) => p.allowedScopes.includes(scopeFilter)).map((p) => p.slug)
          )
        )
      : null;
    setSelectedPerms(
      validSlugs
        ? (role.permission_slugs ?? []).filter((s) => validSlugs.has(s))
        : (role.permission_slugs ?? [])
    );
    setDialogMode("edit");
  };

  const togglePerm = (slug: string) => {
    setSelectedPerms((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleScopeChange = (v: "org" | "branch") => {
    setScopeType(v);
    if (v === "branch") {
      const branchAllowed = new Set<string>(
        permissionGroups.flatMap((g) =>
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
            void refreshAfterMutation();
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
            void refreshAfterMutation();
          },
        }
      );
    }
  };

  const handleDelete = (role: OrgRole) => {
    deleteMutation.mutate({ roleId: role.id }, { onSuccess: () => void refreshAfterMutation() });
  };

  // ── DataView definitions ──────────────────────────────────────────────────────
  const columns = useMemo<DataViewColumnDef<OrgRole>[]>(
    () => [
      {
        key: "name",
        header: t("columns.name"),
        accessor: (row) => (
          <div className="flex items-center gap-2 py-1">
            {row.is_basic ? (
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="truncate font-medium text-foreground">{row.name}</span>
                {row.is_basic && (
                  <Badge variant="secondary" className="text-xs">
                    {t("systemBadge")}
                  </Badge>
                )}
                <ScopeBadge
                  scopeType={row.scope_type}
                  tBadge={(k) => t(`scopeBadges.${k}` as Parameters<typeof t>[0])}
                />
              </div>
            </div>
          </div>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "scope_type",
        header: t("columns.scope"),
        accessor: (row) => (
          <span className="text-sm text-muted-foreground capitalize">
            {t(`filters.scopeOptions.${row.scope_type}` as Parameters<typeof t>[0]) ??
              row.scope_type}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
        compactLabel: true,
      },
      {
        key: "description",
        header: t("columns.description"),
        accessor: (row) =>
          row.description ? (
            <span className="text-sm text-muted-foreground truncate">{row.description}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        defaultVisible: true,
      },
      {
        key: "permission_slugs",
        header: t("columns.permissionCount"),
        accessor: (row) => (
          <Badge variant="outline" className="text-xs">
            {row.permission_slugs.length}
          </Badge>
        ),
        defaultVisible: true,
      },
    ],
    [t]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "select",
        key: "scope",
        label: t("filters.scope"),
        options: [
          { label: t("filters.scopeOptions.org"), value: "org" },
          { label: t("filters.scopeOptions.branch"), value: "branch" },
          { label: t("filters.scopeOptions.both"), value: "both" },
        ],
      },
    ],
    [t]
  );

  const renderCompactItem = useCallback(
    (row: OrgRole) => (
      <div className="flex items-center gap-2 py-0.5">
        {row.is_basic ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-sm font-medium">{row.name}</span>
        <ScopeBadge
          scopeType={row.scope_type}
          tBadge={(k) => t(`scopeBadges.${k}` as Parameters<typeof t>[0])}
        />
      </div>
    ),
    [t]
  );

  const renderDetail = useCallback(
    (role: OrgRole) => (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border">
            {role.is_basic ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Shield className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold leading-tight">{role.name}</h2>
              {role.is_basic && (
                <Badge variant="secondary" className="text-xs">
                  {t("systemBadge")}
                </Badge>
              )}
              <ScopeBadge
                scopeType={role.scope_type}
                tBadge={(k) => t(`scopeBadges.${k}` as Parameters<typeof t>[0])}
              />
            </div>
            {role.description && (
              <p className="text-sm text-muted-foreground">{role.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("detail.scope")}
            </p>
            <span className="capitalize">
              {t(`filters.scopeOptions.${role.scope_type}` as Parameters<typeof t>[0]) ??
                role.scope_type}
            </span>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("detail.id")}
            </p>
            <span className="break-all font-mono text-xs text-muted-foreground">{role.id}</span>
          </div>
          <div className="col-span-2">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("detail.description")}
            </p>
            <span>
              {role.description ?? (
                <span className="text-muted-foreground text-xs">{t("detail.noDescription")}</span>
              )}
            </span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.permissions")}
          </p>
          {role.permission_slugs.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("detail.noPermissions")}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {role.permission_slugs.map((slug) => (
                <Badge key={slug} variant="outline" className="text-xs py-0 font-mono">
                  {slug}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {canManage && !role.is_basic && (
          <div className="flex gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={() => openEdit(role)} disabled={isPending}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.edit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDelete(role)}
              disabled={isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.delete")}
            </Button>
          </div>
        )}
      </div>
    ),
    [t, canManage, isPending, permissionGroups]
  );

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("createButton").replace("Create ", "")}</h2>
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("createButton")}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <DataView<OrgRole, OrgRole>
            entity="org-roles"
            columns={columns}
            filters={filters}
            initialData={initialData}
            queryKey={ROLES_DV_KEY}
            listFetcher={listFetcher}
            detailFetcher={detailFetcher}
            getRowId={(row) => row.id}
            renderCompactItem={renderCompactItem}
            renderDetail={renderDetail}
            className="h-full"
          />
        </div>
      </div>

      {/* Create / Edit Role Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-xl" aria-describedby={undefined}>
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
                      tBadge={(k) => t(`scopeBadges.${k}` as Parameters<typeof t>[0])}
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
              {(() => {
                const effectiveScopeFilter: "org" | "branch" | null =
                  dialogMode === "edit" && editingRole
                    ? editingRole.scope_type === "org" || editingRole.scope_type === "branch"
                      ? (editingRole.scope_type as "org" | "branch")
                      : null
                    : scopeType;
                const visibleGroups = permissionGroups
                  .map((g) => ({
                    ...g,
                    permissions: effectiveScopeFilter
                      ? g.permissions.filter((p) => p.allowedScopes.includes(effectiveScopeFilter))
                      : g.permissions,
                  }))
                  .filter((g) => g.permissions.length > 0);
                return visibleGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </p>
                    {group.permissions.map((perm) => (
                      <div
                        key={perm.slug}
                        className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`perm-${perm.slug}`}
                          checked={selectedPerms.includes(perm.slug)}
                          onCheckedChange={() => togglePerm(perm.slug)}
                          disabled={isPending}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={`perm-${perm.slug}`}
                          className="flex-1 cursor-pointer font-normal text-sm"
                        >
                          {perm.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                ));
              })()}
              {selectedPerms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("dialog.permissionsSelected", { count: selectedPerms.length })}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
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
    </>
  );
}
