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
import { MEMBERS_MANAGE } from "@/lib/constants/permissions";
import {
  allowedInScope,
  groupCatalog,
  isWildcard,
  permissionLabelKey,
  type CatalogPermission,
} from "@/lib/permissions/permission-catalog";
import {
  useRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from "@/hooks/queries/organization";
import type { OrgRole } from "@/server/services/organization.service";
import { DataView } from "@/components/data-view/data-view";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { filterSortRoles, paginateRoles } from "../_utils/data-view";

const ROLES_DV_KEY = ["org-roles-dataview"];

interface RolesClientProps {
  orgId: string;
  initialData: PaginatedResult<OrgRole>;
  allRoles: OrgRole[];
  /** Every permission the organization may put in a role, from the database */
  permissionCatalog: CatalogPermission[];
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

export function RolesClient({
  orgId,
  initialData,
  allRoles: initialAllRoles,
  permissionCatalog,
}: RolesClientProps) {
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

  const [permSearch, setPermSearch] = useState("");

  const labelOf = useCallback(
    (perm: Pick<CatalogPermission, "slug" | "name">): string => {
      const key = `catalog.perms.${permissionLabelKey(perm.slug)}`;
      if (t.has(key as Parameters<typeof t>[0])) return t(key as Parameters<typeof t>[0]);
      if (isWildcard(perm.slug)) return t("catalog.all");
      return perm.name ?? perm.slug;
    },
    [t]
  );

  const groupLabel = useCallback(
    (category: string): string => {
      const key = `catalog.groups.${category}`;
      return t.has(key as Parameters<typeof t>[0]) ? t(key as Parameters<typeof t>[0]) : category;
    },
    [t]
  );

  const catalogBySlug = useMemo(
    () => new Map(permissionCatalog.map((p) => [p.slug, p])),
    [permissionCatalog]
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
    setPermSearch("");
    setDialogMode("create");
  };

  const openEdit = (role: OrgRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? "");
    // Keep every permission the role has, also the ones this editor does not list,
    // so saving the role never drops them.
    setSelectedPerms(role.permission_slugs ?? []);
    setPermSearch("");
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
      setSelectedPerms((prev) => prev.filter((s) => allowedInScope(s, "branch")));
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
                <Badge key={slug} variant="outline" className="text-xs py-0" title={slug}>
                  {labelOf({ slug, name: catalogBySlug.get(slug)?.name ?? null })}
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
    [t, canManage, isPending, labelOf, catalogBySlug]
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
            scope={dataViewScope.organization(orgId)}
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
                const scope: "org" | "branch" | null =
                  dialogMode === "edit" && editingRole
                    ? editingRole.scope_type === "org" || editingRole.scope_type === "branch"
                      ? editingRole.scope_type
                      : null
                    : scopeType;
                const groups = groupCatalog(permissionCatalog, scope);
                const listed = new Set(groups.flatMap((g) => g.permissions.map((p) => p.slug)));
                const hiddenKept = selectedPerms.filter((slug) => !listed.has(slug)).length;
                const q = permSearch.trim().toLowerCase();
                const visibleGroups = groups
                  .map((g) => ({
                    ...g,
                    permissions: q
                      ? g.permissions.filter(
                          (p) =>
                            labelOf(p).toLowerCase().includes(q) ||
                            p.slug.toLowerCase().includes(q) ||
                            groupLabel(g.category).toLowerCase().includes(q)
                        )
                      : g.permissions,
                  }))
                  .filter((g) => g.permissions.length > 0);
                return (
                  <>
                    <Input
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder={t("catalog.search")}
                      aria-label={t("catalog.search")}
                      className="h-8"
                    />
                    {visibleGroups.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t("catalog.noMatch")}</p>
                    )}
                    {visibleGroups.map((group) => {
                      const wildcard = group.permissions.find((p) => isWildcard(p.slug));
                      const coveredByWildcard = !!wildcard && selectedPerms.includes(wildcard.slug);
                      return (
                        <div
                          key={group.category}
                          className="space-y-1"
                          data-testid={`perm-group-${group.category}`}
                        >
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {groupLabel(group.category)}
                          </p>
                          {group.permissions.map((perm) => {
                            const covered = coveredByWildcard && !isWildcard(perm.slug);
                            return (
                              <div
                                key={perm.slug}
                                className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                              >
                                <Checkbox
                                  id={`perm-${perm.slug}`}
                                  checked={covered || selectedPerms.includes(perm.slug)}
                                  onCheckedChange={() => togglePerm(perm.slug)}
                                  disabled={isPending || covered}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`perm-${perm.slug}`}
                                  className="flex-1 cursor-pointer font-normal text-sm"
                                >
                                  {labelOf(perm)}
                                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                    {perm.slug}
                                  </span>
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {hiddenKept > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("catalog.hiddenKept", { count: hiddenKept })}
                      </p>
                    )}
                  </>
                );
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
