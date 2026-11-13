"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Send, X, RefreshCw, Plus, GitBranch, AlertCircle } from "lucide-react";
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
  useInvitationsQuery,
  useCreateInvitationMutation,
  useCancelInvitationMutation,
  useResendInvitationMutation,
  useRolesQuery,
  useBranchesQuery,
  useInvitationsRealtimeSync,
} from "@/hooks/queries/organization";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import type { OrgInvitation, OrgRole, OrgBranch } from "@/server/services/organization.service";
import {
  invitationHref,
  invitationPage,
  invitationParsers,
  invitedName,
  INVITATION_PAGE_SIZES,
  INVITATION_STATUSES,
  type InvitationState,
} from "./invitations-state";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accepted: "default",
  cancelled: "secondary",
  expired: "destructive",
  declined: "secondary",
};

interface InvitationsWorkspaceProps {
  initialInvitations: OrgInvitation[];
  initialRoles: OrgRole[];
  initialBranches: OrgBranch[];
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canCreate: boolean;
  canCancel: boolean;
}

type RoleScopeConfig = { scope: "org" | "branch"; branchIds: string[] };

/**
 * The invitations: all of them, filtered by status, sorted and paged by the
 * address, kept live by the realtime sync, with the open one beside the list.
 */
export function InvitationsWorkspace({
  initialInvitations,
  initialRoles,
  initialBranches,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  canCreate,
  canCancel,
}: InvitationsWorkspaceProps) {
  const t = useTranslations("adminInvitations");

  const activeOrgId = useAppStoreV2((s) => s.activeOrgId);
  useInvitationsRealtimeSync(activeOrgId);

  const [state] = useQueryStates(invitationParsers);
  const invitations = useInvitationsQuery(initialInvitations);
  const all = useMemo(() => invitations.data ?? [], [invitations.data]);
  const page = useMemo(() => invitationPage(all, state), [all, state]);
  const [layout, setLayout] = useState(savedLayout);

  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const href = useCallback(
    (patch: Partial<InvitationState>) => invitationHref(path, state, patch),
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

  const { data: roles } = useRolesQuery(initialRoles);
  const { data: branches } = useBranchesQuery(initialBranches);

  const createMutation = useCreateInvitationMutation();
  const cancelMutation = useCancelInvitationMutation();
  const resendMutation = useResendInvitationMutation();

  const isPending =
    createMutation.isPending || cancelMutation.isPending || resendMutation.isPending;

  const assignableRoles = roles.filter((r) => !r.is_basic && !r.deleted_at);
  const activeBranches = branches.filter((b) => !b.deleted_at);

  // ── Invite dialog state ───────────────────────────────────────────────────────
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleScopeConfigs, setRoleScopeConfigs] = useState<Map<string, RoleScopeConfig>>(new Map());
  const [dialogError, setDialogError] = useState<string | null>(null);

  const INVITE_ERROR_KEYS: Record<string, string> = {
    DUPLICATE_PENDING: t("inviteErrors.DUPLICATE_PENDING"),
    ALREADY_MEMBER: t("inviteErrors.ALREADY_MEMBER"),
    ALREADY_IN_ORG: t("inviteErrors.ALREADY_IN_ORG"),
    SELF_INVITE: t("inviteErrors.SELF_INVITE"),
    UNAUTHORIZED: t("inviteErrors.UNAUTHORIZED"),
    INVALID_EMAIL: t("inviteErrors.INVALID_EMAIL"),
  };
  const mapInviteError = (raw: string) => INVITE_ERROR_KEYS[raw] ?? t("inviteErrors.UNKNOWN");

  const resetDialog = () => {
    setEmail("");
    setSelectedRoleIds([]);
    setRoleScopeConfigs(new Map());
    setDialogError(null);
  };

  const toggleRole = (roleId: string, scopeType: string) => {
    const isSelected = selectedRoleIds.includes(roleId);
    if (isSelected) {
      setSelectedRoleIds((prev) => prev.filter((id) => id !== roleId));
      setRoleScopeConfigs((prev) => {
        const next = new Map(prev);
        next.delete(roleId);
        return next;
      });
    } else {
      const defaultScope: "org" | "branch" = scopeType === "branch" ? "branch" : "org";
      setSelectedRoleIds((prev) => [...prev, roleId]);
      setRoleScopeConfigs((prev) =>
        new Map(prev).set(roleId, { scope: defaultScope, branchIds: [] })
      );
    }
  };

  const setRoleScope = (roleId: string, scope: "org" | "branch") => {
    setRoleScopeConfigs((prev) => {
      const next = new Map(prev);
      const ex = next.get(roleId) ?? { scope: "org" as const, branchIds: [] };
      next.set(roleId, { ...ex, scope, branchIds: scope === "org" ? [] : ex.branchIds });
      return next;
    });
  };

  const toggleBranchForRole = (roleId: string, branchId: string) => {
    setRoleScopeConfigs((prev) => {
      const next = new Map(prev);
      const ex = next.get(roleId) ?? { scope: "branch" as const, branchIds: [] };
      const has = ex.branchIds.includes(branchId);
      next.set(roleId, {
        ...ex,
        branchIds: has ? ex.branchIds.filter((id) => id !== branchId) : [...ex.branchIds, branchId],
      });
      return next;
    });
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    setDialogError(null);
    type RoleAssignment = { role_id: string; scope: "org" | "branch"; scope_id: string | null };
    const role_assignments: RoleAssignment[] | undefined =
      selectedRoleIds.length > 0
        ? selectedRoleIds.flatMap<RoleAssignment>((roleId) => {
            const config = roleScopeConfigs.get(roleId);
            if (config?.scope === "branch")
              return config.branchIds.map((bid) => ({
                role_id: roleId,
                scope: "branch" as const,
                scope_id: bid,
              }));
            return [{ role_id: roleId, scope: "org" as const, scope_id: null }];
          })
        : undefined;
    createMutation.mutate(
      { email: email.trim(), role_assignments },
      {
        onSuccess: () => {
          resetDialog();
          setShowInviteDialog(false);
        },
        onError: (err: Error) => setDialogError(mapInviteError(err.message)),
      }
    );
  };

  const handleCancel = (inv: OrgInvitation) => {
    cancelMutation.mutate({ invitationId: inv.id }, undefined);
  };

  const handleResend = (inv: OrgInvitation) => {
    resendMutation.mutate({ invitationId: inv.id }, undefined);
  };

  const statusLabel = (status: string) =>
    t.has(`statusLabels.${status}` as Parameters<typeof t>[0])
      ? t(`statusLabels.${status}` as Parameters<typeof t>[0])
      : status;
  const statusBadge = (row: OrgInvitation) => (
    <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} className="font-normal">
      {statusLabel(row.status)}
    </Badge>
  );
  const fields: FilterField[] = [
    {
      kind: "list",
      id: "status",
      label: t("filters.status"),
      options: INVITATION_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
    },
  ];
  const order = ["invitation", ...layout.map((column) => column.id)];
  const sortOf = (field: InvitationState["sort"]) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const rowHref = (row: OrgInvitation) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const day = (value: string | null) =>
    value ? (
      <span className="text-xs text-muted-foreground">
        {new Date(value).toLocaleDateString(labels.locale)}
      </span>
    ) : (
      "—"
    );
  const selected =
    all.find((invitation) => invitation.id === state.selected && !invitation.deleted_at) ?? null;
  const filtered = !!(state.q || state.status.length);

  const renderDetail = (inv: OrgInvitation) => (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight break-all">{inv.email}</h2>
          <Badge
            variant={STATUS_VARIANT[inv.status] ?? "outline"}
            className="mt-1 text-xs capitalize"
          >
            {t(`statusLabels.${inv.status}` as Parameters<typeof t>[0]) ?? inv.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.expires")}
          </p>
          <span>{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}</span>
        </div>
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.created")}
          </p>
          <span>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}</span>
        </div>
        <div className="col-span-2">
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.roles")}
          </p>
          <span className="text-sm">
            {inv.role_summary ?? (
              <span className="text-muted-foreground text-xs">{t("detail.noRoles")}</span>
            )}
          </span>
        </div>
        <div className="col-span-2">
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.id")}
          </p>
          <span className="break-all font-mono text-xs text-muted-foreground">{inv.id}</span>
        </div>
      </div>

      {inv.status === "pending" && (canCreate || canCancel) && (
        <div className="flex gap-2 border-t pt-3">
          {canCreate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResend(inv)}
              disabled={isPending}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.resend")}
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => handleCancel(inv)}
              disabled={isPending}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.cancel")}
            </Button>
          )}
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
          {canCreate ? (
            <Button
              size="sm"
              onClick={() => {
                resetDialog();
                setShowInviteDialog(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" />
              {t("inviteMemberButton")}
            </Button>
          ) : null}
        </header>
        <div className="ks-list-filter-row">
          <FilterBar
            parsers={invitationParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            pending={invitations.isFetching}
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
            sizes={INVITATION_PAGE_SIZES}
            selected={state.selected}
            rowKey={(row) => row.id}
            rowHref={rowHref}
            pageHref={(strona) => href({ strona, selected: null })}
            sizeHref={(wierszy) =>
              href({ wierszy: wierszy as InvitationState["wierszy"], strona: 1, selected: null })
            }
            set={set}
            layout={layout}
            widths={widths}
            cookie={cookie}
            onLayoutChange={setLayout}
            sortOf={(id) =>
              id === "status" || id === "created_at" || id === "expires_at" ? sortOf(id) : undefined
            }
            pinnedSort={sortOf("email")}
            identity={(row) => (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  <Mail className="size-3.5 text-muted-foreground" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium" title={row.email}>
                    {row.email}
                  </span>
                  {invitedName(row) ? (
                    <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
                      {invitedName(row)}
                    </span>
                  ) : null}
                </span>
              </>
            )}
            value={(row, id) =>
              id === "status" ? (
                statusBadge(row)
              ) : id === "roles" ? (
                <span className="text-muted-foreground">{row.role_summary || "—"}</span>
              ) : id === "created_at" ? (
                day(row.created_at)
              ) : (
                day(row.expires_at)
              )
            }
            badge={statusBadge}
            labels={labels}
            empty={filtered ? labels.empty : labels.emptyAll}
            loading={invitations.isPending}
            error={invitations.isError ? invitations.error.message : null}
            onRetry={() => void invitations.refetch()}
            onPreview={preview}
          />
          {state.selected ? (
            <ListSidePanel
              titleId="org-invitation-panel-title"
              title={selected?.email ?? labels.notFound}
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

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="invite-email">
                {t("emailAddressLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setDialogError(null);
                }}
                placeholder={t("form.emailPlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                disabled={isPending}
              />
            </div>
            {assignableRoles.length > 0 && (
              <div className="space-y-2">
                <Label>{t("rolesLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("rolesHint")}</p>
                <div className="space-y-1 rounded-md border p-2">
                  {assignableRoles.map((role) => {
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
                            id={`inv-role-${role.id}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleRole(role.id, role.scope_type)}
                            disabled={isPending}
                            className="mt-0.5"
                          />
                          <Label htmlFor={`inv-role-${role.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{role.name}</span>
                              {role.scope_type === "branch" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs gap-1 py-0 text-blue-600 border-blue-300"
                                >
                                  <GitBranch className="h-2.5 w-2.5" />
                                  {t("form.scopeBranch")}
                                </Badge>
                              )}
                              {role.scope_type === "both" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs py-0 text-purple-600 border-purple-300"
                                >
                                  {t("form.scopeBranch")}/{t("form.scopeOrg")}
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
                              {t("form.scopeOrg")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={config?.scope === "branch" ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => setRoleScope(role.id, "branch")}
                              disabled={isPending}
                            >
                              {t("form.scopeBranch")}
                            </Button>
                          </div>
                        )}
                        {showBranchSelector && (
                          <div className="ml-7 space-y-1">
                            {activeBranches.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {t("form.noBranches")}
                              </p>
                            ) : (
                              activeBranches.map((branch) => (
                                <div key={branch.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`inv-branch-${role.id}-${branch.id}`}
                                    checked={config?.branchIds.includes(branch.id) ?? false}
                                    onCheckedChange={() => toggleBranchForRole(role.id, branch.id)}
                                    disabled={isPending}
                                  />
                                  <Label
                                    htmlFor={`inv-branch-${role.id}-${branch.id}`}
                                    className="text-xs font-normal cursor-pointer"
                                  >
                                    {branch.name}
                                  </Label>
                                </div>
                              ))
                            )}
                            {config?.branchIds.length === 0 && (
                              <p className="text-xs text-amber-600">{t("form.selectBranchHint")}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {dialogError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{dialogError}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              disabled={isPending}
            >
              {t("cancelButton")}
            </Button>
            <Button onClick={handleInvite} disabled={isPending || !email.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {isPending ? t("sendingButton") : t("sendButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableNavigationProvider>
  );
}
