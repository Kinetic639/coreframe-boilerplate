"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
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
import { Link } from "@/i18n/navigation";
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
import {
  memberHref,
  memberName,
  memberPage,
  memberParsers,
  positionsByUser,
  MEMBER_PAGE_SIZES,
  MEMBER_STATUSES,
  type MemberState,
} from "./members-state";

interface MembersWorkspaceProps {
  initialMembers: OrgMember[];
  initialPositions: OrgPosition[];
  initialAssignments: OrgPositionAssignment[];
  initialRoles: OrgRole[];
  initialBranches: OrgBranch[];
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canManage: boolean;
}

type RoleScopeConfig = { scope: "org" | "branch"; branchIds: string[] };
type RoleSummary = { name: string; scope: string; branchNames: string[] };

/**
 * The members: all of them, filtered, sorted and paged by the address, kept
 * live by the realtime sync, with the open one (and its roles and position)
 * beside the list.
 */
export function MembersWorkspace({
  initialMembers,
  initialPositions,
  initialAssignments,
  initialRoles,
  initialBranches,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  canManage,
}: MembersWorkspaceProps) {
  const t = useTranslations("modules.organizationManagement.members");
  const activeOrgId = useAppStoreV2((s) => s.activeOrgId);
  useMembersRealtimeSync(activeOrgId);

  const [state] = useQueryStates(memberParsers);
  const members = useMembersQuery(initialMembers);
  const { data: positions } = usePositionsQuery(initialPositions);
  const { data: assignments } = useAssignmentsQuery(initialAssignments);
  const { data: availableRoles } = useRolesQuery(initialRoles);
  const { data: branches } = useBranchesQuery(initialBranches);

  const all = useMemo(() => members.data ?? [], [members.data]);
  const positionByUser = useMemo(() => positionsByUser(assignments), [assignments]);
  const branchNameMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const page = useMemo(() => memberPage(all, state, positionByUser), [all, state, positionByUser]);
  const [layout, setLayout] = useState(savedLayout);

  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback(
    (patch: Partial<MemberState>) => memberHref(path, state, patch),
    [path, state]
  );
  const preview = useCallback(
    (selected: string | null) => navigate(href({ selected })),
    [navigate, href]
  );
  const keys = useMemo(() => page.rows.map((row) => row.user_id), [page.rows]);
  useListKeys(keys, state.selected, preview);
  useEffect(() => {
    if (state.strona !== page.page) {
      window.history.replaceState(null, "", href({ strona: page.page }));
    }
  }, [href, page.page, state.strona]);

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

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [assignPositionMember, setAssignPositionMember] = useState<OrgMember | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [assignRoleMember, setAssignRoleMember] = useState<OrgMember | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleScopeConfigs, setRoleScopeConfigs] = useState<Map<string, RoleScopeConfig>>(new Map());

  // ── Status toggle ─────────────────────────────────────────────────────────────
  const handleStatusToggle = (member: OrgMember) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    statusMutation.mutate(
      { userId: member.user_id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(newStatus === "active" ? t("toasts.activated") : t("toasts.deactivated"));
        },
      }
    );
  };

  const handleRemove = (member: OrgMember) => {
    if (!window.confirm(labels.confirmRemove.replace("{name}", memberName(member)))) return;
    removeMutation.mutate(
      { userId: member.user_id },
      { onSuccess: () => state.selected === member.user_id && preview(null) }
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

  /** The member's roles, once each (a branch role with its branches). */
  const rolesOf = (member: OrgMember): RoleSummary[] => {
    const unique = new Map<string, RoleSummary>();
    for (const r of member.roles) {
      const branchName = r.scope === "branch" ? branchNameMap.get(r.scope_id) : undefined;
      const ex = unique.get(r.id);
      if (ex) {
        if (branchName) ex.branchNames.push(branchName);
      } else {
        unique.set(r.id, {
          name: r.name,
          scope: r.scope,
          branchNames: branchName ? [branchName] : [],
        });
      }
    }
    return [...unique.values()];
  };

  const statusBadge = (member: OrgMember) => (
    <Badge variant={member.status === "active" ? "default" : "secondary"} className="text-xs">
      {member.status === "active" ? t("statusOptions.active") : t("statusOptions.inactive")}
    </Badge>
  );
  const avatar = (member: OrgMember, size: string) => (
    <Avatar className={`${size} shrink-0`}>
      <AvatarImage src={member.user_avatar_url ?? undefined} />
      <AvatarFallback className="text-xs">{getInitials(member)}</AvatarFallback>
    </Avatar>
  );
  const dash = <span className="text-xs text-muted-foreground">—</span>;

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "status",
      label: t("filters.status"),
      options: MEMBER_STATUSES.map((value) => ({
        value,
        label: value === "active" ? t("statusOptions.active") : t("statusOptions.inactive"),
      })),
    },
    {
      kind: "list",
      id: "rola",
      label: labels.column_roles,
      options: availableRoles
        .filter((role) => !role.deleted_at)
        .map((role) => ({ value: role.id, label: role.name })),
    },
    {
      kind: "list",
      id: "stanowisko",
      label: labels.column_position,
      options: positions.map((position) => ({ value: position.id, label: position.name })),
    },
  ];
  const sortOf = (field: MemberState["sort"]) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const rowHref = (row: OrgMember) =>
    href({ selected: state.selected === row.user_id ? null : row.user_id });
  const filtered =
    Boolean(state.q) || state.status.length + state.rola.length + state.stanowisko.length > 0;
  const selected = all.find((member) => member.user_id === state.selected) ?? null;
  const selectedPosition = selected ? positionByUser.get(selected.user_id) : undefined;

  const value = (row: OrgMember, id: string) => {
    if (id === "status") return statusBadge(row);
    if (id === "roles") {
      const list = rolesOf(row);
      if (!list.length) return dash;
      return (
        <span className="flex flex-wrap gap-1">
          {list.slice(0, 2).map((role, i) => (
            <Badge key={i} variant="secondary" className="gap-1 py-0 text-xs">
              <Shield className="size-2.5 shrink-0" />
              <span className="max-w-[120px] truncate">{role.name}</span>
            </Badge>
          ))}
          {list.length > 2 ? (
            <Badge variant="secondary" className="py-0 text-xs">
              +{list.length - 2}
            </Badge>
          ) : null}
        </span>
      );
    }
    if (id === "position") {
      const name = positionByUser.get(row.user_id)?.position_name;
      return name ? (
        <Badge variant="outline" className="gap-1 py-0 text-xs">
          <Briefcase className="size-2.5" />
          {name}
        </Badge>
      ) : (
        dash
      );
    }
    return row.joined_at ? (
      <span className="text-xs text-muted-foreground">
        {new Date(row.joined_at).toLocaleDateString(labels.locale)}
      </span>
    ) : (
      dash
    );
  };

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{labels.title}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{page.totalCount}</span>
          </div>
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={memberParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            pending={members.isFetching}
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <ListPane
            rows={page.rows}
            totalCount={page.totalCount}
            page={page.page}
            size={state.wierszy}
            sizes={MEMBER_PAGE_SIZES}
            selected={state.selected}
            rowKey={(row) => row.user_id}
            rowHref={rowHref}
            pageHref={(strona) => href({ strona, selected: null })}
            sizeHref={(wierszy) =>
              href({ wierszy: wierszy as MemberState["wierszy"], strona: 1, selected: null })
            }
            set={set}
            layout={layout}
            widths={widths}
            cookie={cookie}
            onLayoutChange={setLayout}
            sortOf={(id) =>
              id === "status"
                ? sortOf("status")
                : id === "joined_at"
                  ? sortOf("joined_at")
                  : undefined
            }
            pinnedSort={sortOf("name")}
            identity={(row) => (
              <>
                {avatar(row, "size-7")}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium" title={displayName(row)}>
                    {displayName(row)}
                  </span>
                  {row.user_first_name || row.user_last_name ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.user_email}
                    </span>
                  ) : null}
                </span>
              </>
            )}
            value={value}
            badge={statusBadge}
            labels={labels}
            empty={filtered ? labels.empty : labels.emptyAll}
            onPreview={preview}
          />
          {state.selected ? (
            <ListSidePanel
              titleId="org-member-panel-title"
              title={selected ? displayName(selected) : labels.notFound}
              backLabel={labels.title}
              closeLabel={labels.close}
              onClose={() => preview(null)}
            >
              {selected ? (
                <div className="space-y-5 p-5">
                  <div className="flex items-start gap-3">
                    {avatar(selected, "size-10")}
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight">
                        {displayName(selected)}
                      </h3>
                      <p className="text-sm text-muted-foreground">{selected.user_email}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="mb-0.5 text-xs text-muted-foreground">{t("detail.status")}</dt>
                      <dd>{statusBadge(selected)}</dd>
                    </div>
                    <div>
                      <dt className="mb-0.5 text-xs text-muted-foreground">{t("detail.joined")}</dt>
                      <dd>
                        {selected.joined_at
                          ? new Date(selected.joined_at).toLocaleDateString(labels.locale)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-0.5 text-xs text-muted-foreground">
                        {t("detail.position")}
                      </dt>
                      <dd>
                        {selectedPosition?.position_name ? (
                          <Badge variant="outline" className="gap-1 py-0 text-xs">
                            <Briefcase className="size-2.5" />
                            {selectedPosition.position_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("detail.noPosition")}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-0.5 text-xs text-muted-foreground">{t("detail.email")}</dt>
                      <dd className="break-all text-xs">{selected.user_email}</dd>
                    </div>
                  </dl>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">{t("detail.roles")}</p>
                    {rolesOf(selected).length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("detail.noRoles")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {rolesOf(selected).map((role, i) => (
                          <Badge key={i} variant="secondary" className="gap-1 py-0 text-xs">
                            <Shield className="size-2.5 shrink-0" />
                            <span>{role.name}</span>
                            {role.scope === "branch" && role.branchNames.length > 0 ? (
                              <span className="font-normal opacity-60">
                                · {role.branchNames.join(", ")}
                              </span>
                            ) : null}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <Link
                      href={{
                        pathname: "/dashboard/organization/users/members/[memberId]",
                        params: { memberId: selected.user_id },
                      }}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                      {t("detail.viewDetails")}
                    </Link>
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusToggle(selected)}
                        disabled={isPending}
                      >
                        {selected.status === "active" ? (
                          <>
                            <UserX className="mr-1.5 size-3.5" />
                            {t("actions.deactivate")}
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-1.5 size-3.5" />
                            {t("actions.activate")}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAssignRoles(selected)}
                        disabled={isPending}
                      >
                        <Shield className="mr-1.5 size-3.5" />
                        {t("actions.manageRoles")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAssignPosition(selected)}
                        disabled={isPending}
                      >
                        <Briefcase className="mr-1.5 size-3.5" />
                        {selectedPosition
                          ? t("actions.changePosition")
                          : t("actions.assignPosition")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(selected)}
                        disabled={isPending}
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        {t("actions.removeMember")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">{labels.notFound}</p>
              )}
            </ListSidePanel>
          ) : null}
        </div>
      </section>

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
    </TableNavigationProvider>
  );
}
