"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
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
import { FilterBar, type FilterField } from "@/components/kolor-sensu/data-table/filter-bar";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import { ListPane, ListSidePanel } from "@/components/kolor-sensu/data-table/list-pane";
import { useListKeys } from "@/components/kolor-sensu/data-table/use-list-keys";
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
import {
  roleHref,
  rolePage,
  roleParsers,
  ROLE_KINDS,
  ROLE_PAGE_SIZES,
  ROLE_SCOPES,
  type RoleState,
} from "./roles-state";

interface RolesWorkspaceProps {
  initialRoles: OrgRole[];
  /** Every permission the organization may put in a role, from the database */
  permissionCatalog: CatalogPermission[];
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canManage: boolean;
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

/**
 * The roles: system and the organization's own, filtered, sorted and paged by
 * the address, with the open role's permissions beside the list.
 */
export function RolesWorkspace({
  initialRoles,
  permissionCatalog,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  canManage,
}: RolesWorkspaceProps) {
  const t = useTranslations("modules.organizationManagement.roles");
  const [state] = useQueryStates(roleParsers);
  const roles = useRolesQuery(initialRoles);
  const all = useMemo(() => roles.data ?? [], [roles.data]);
  const page = useMemo(() => rolePage(all, state), [all, state]);
  const [layout, setLayout] = useState(savedLayout);

  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback(
    (patch: Partial<RoleState>) => roleHref(path, state, patch),
    [path, state]
  );
  const preview = useCallback(
    (selected: string | null) => navigate(href({ selected })),
    [navigate, href]
  );
  const keys = useMemo(() => page.rows.map((row) => row.id), [page.rows]);
  useListKeys(keys, state.selected, preview);
  useEffect(() => {
    if (state.strona !== page.page) {
      window.history.replaceState(null, "", href({ strona: page.page }));
    }
  }, [href, page.page, state.strona]);

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
          onSuccess: (role) => {
            setDialogMode(null);
            preview(role.id);
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
        { onSuccess: () => setDialogMode(null) }
      );
    }
  };

  const handleDelete = (role: OrgRole) => {
    if (!window.confirm(labels.confirmDelete.replace("{name}", role.name))) return;
    deleteMutation.mutate(
      { roleId: role.id },
      { onSuccess: () => state.selected === role.id && preview(null) }
    );
  };

  const scopeLabel = (scope: string) =>
    t.has(`filters.scopeOptions.${scope}` as Parameters<typeof t>[0])
      ? t(`filters.scopeOptions.${scope}` as Parameters<typeof t>[0])
      : scope;
  const roleIcon = (role: OrgRole) =>
    role.is_basic ? (
      <Lock className="size-3.5 text-muted-foreground" />
    ) : (
      <Shield className="size-3.5 text-muted-foreground" />
    );
  const fields: FilterField[] = [
    {
      kind: "list",
      id: "zakres",
      label: t("filters.scope"),
      options: ROLE_SCOPES.map((value) => ({ value, label: scopeLabel(value) })),
    },
    {
      kind: "list",
      id: "rodzaj",
      label: labels.column_kind,
      options: ROLE_KINDS.map((value) => ({ value, label: labels[`kind_${value}`] })),
    },
  ];
  const order = ["role", ...layout.map((column) => column.id)].map((id) =>
    id === "scope" ? "zakres" : id
  );
  const sortOf = (field: RoleState["sort"]) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const rowHref = (row: OrgRole) => href({ selected: state.selected === row.id ? null : row.id });
  const selected = all.find((role) => role.id === state.selected && !role.deleted_at) ?? null;
  const filtered = !!(state.q || state.zakres.length || state.rodzaj.length);

  const renderDetail = (role: OrgRole) => (
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
          {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
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
  );

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{labels.title}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{page.totalCount}</span>
          </div>
          {canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" />
              {t("createButton")}
            </Button>
          ) : null}
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={roleParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            order={order}
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <ListPane
            rows={page.rows}
            totalCount={page.totalCount}
            page={page.page}
            size={state.wierszy}
            sizes={ROLE_PAGE_SIZES}
            selected={state.selected}
            rowKey={(row) => row.id}
            rowHref={rowHref}
            pageHref={(strona) => href({ strona, selected: null })}
            sizeHref={(wierszy) =>
              href({ wierszy: wierszy as RoleState["wierszy"], strona: 1, selected: null })
            }
            set={set}
            layout={layout}
            widths={widths}
            cookie={cookie}
            onLayoutChange={setLayout}
            sortOf={(id) =>
              id === "scope"
                ? sortOf("scope_type")
                : id === "permissions"
                  ? sortOf("permissions")
                  : undefined
            }
            pinnedSort={sortOf("name")}
            identity={(row) => (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  {roleIcon(row)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium" title={row.name}>
                    {row.name}
                  </span>
                  {row.is_basic ? (
                    <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
                      {t("systemBadge")}
                    </span>
                  ) : null}
                </span>
              </>
            )}
            value={(row, id) =>
              id === "scope" ? (
                <span className="flex items-center gap-1.5">{scopeLabel(row.scope_type)}</span>
              ) : id === "permissions" ? (
                <span className="tabular-nums">{row.permission_slugs.length}</span>
              ) : (
                <span className="text-muted-foreground">{row.description || "—"}</span>
              )
            }
            badge={(row) => (
              <ScopeBadge
                scopeType={row.scope_type}
                tBadge={(k) => t(`scopeBadges.${k}` as Parameters<typeof t>[0])}
              />
            )}
            labels={labels}
            empty={filtered ? labels.empty : t("noRoles")}
            onPreview={preview}
          />
          {state.selected ? (
            <ListSidePanel
              titleId="org-role-panel-title"
              title={selected?.name ?? labels.notFound}
              backLabel={labels.title}
              closeLabel={labels.close}
              onClose={() => preview(null)}
            >
              {selected ? (
                <div className="p-5">{renderDetail(selected)}</div>
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">{labels.notFound}</p>
              )}
            </ListSidePanel>
          ) : null}
        </div>
      </section>

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
    </TableNavigationProvider>
  );
}
