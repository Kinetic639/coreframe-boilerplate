"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import { useRouter } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { INVITES_CREATE, INVITES_CANCEL } from "@/lib/constants/permissions";
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
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { filterSortInvitations, paginateInvitations } from "../_utils/data-view";

const INVITATIONS_DV_KEY = ["org-invitations-dataview"];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accepted: "default",
  cancelled: "secondary",
  expired: "destructive",
  declined: "secondary",
};

interface InvitationsClientProps {
  initialData: PaginatedResult<OrgInvitation>;
  allInvitations: OrgInvitation[];
  initialRoles: OrgRole[];
  initialBranches: OrgBranch[];
}

type RoleScopeConfig = { scope: "org" | "branch"; branchIds: string[] };

export function InvitationsClient({
  initialData,
  allInvitations: initialAllInvitations,
  initialRoles,
  initialBranches,
}: InvitationsClientProps) {
  const t = useTranslations("adminInvitations");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const activeOrgId = useAppStoreV2((s) => s.activeOrgId);
  useInvitationsRealtimeSync(activeOrgId);

  const allRef = useRef(initialAllInvitations);
  allRef.current = initialAllInvitations;

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<OrgInvitation>> => {
      const filtered = filterSortInvitations(allRef.current, params);
      return paginateInvitations(filtered, params.page, params.pageSize);
    },
    []
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<OrgInvitation | null> =>
      allRef.current.find((i) => i.id === id) ?? null,
    []
  );

  // Seed React Query cache for realtime sync
  useInvitationsQuery(initialAllInvitations);
  const { data: roles } = useRolesQuery(initialRoles);
  const { data: branches } = useBranchesQuery(initialBranches);

  const createMutation = useCreateInvitationMutation();
  const cancelMutation = useCancelInvitationMutation();
  const resendMutation = useResendInvitationMutation();

  const isPending =
    createMutation.isPending || cancelMutation.isPending || resendMutation.isPending;
  const canCreate = can(INVITES_CREATE);
  const canCancel = can(INVITES_CANCEL);

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
          void refreshAfterMutation();
        },
        onError: (err: Error) => setDialogError(mapInviteError(err.message)),
      }
    );
  };

  const refreshAfterMutation = async () => {
    await queryClient.invalidateQueries({ queryKey: INVITATIONS_DV_KEY });
    router.refresh();
  };

  const handleCancel = (inv: OrgInvitation) => {
    cancelMutation.mutate(
      { invitationId: inv.id },
      { onSuccess: () => void refreshAfterMutation() }
    );
  };

  const handleResend = (inv: OrgInvitation) => {
    resendMutation.mutate(
      { invitationId: inv.id },
      { onSuccess: () => void refreshAfterMutation() }
    );
  };

  // ── DataView definitions ──────────────────────────────────────────────────────
  const columns = useMemo<DataViewColumnDef<OrgInvitation>[]>(
    () => [
      {
        key: "email",
        header: t("columns.email"),
        accessor: (row) => (
          <div className="flex items-center gap-2 py-1">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{row.email}</span>
          </div>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "status",
        header: t("columns.status"),
        accessor: (row) => (
          <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} className="text-xs capitalize">
            {t(`statusLabels.${row.status}` as Parameters<typeof t>[0]) ?? row.status}
          </Badge>
        ),
        sortable: true,
        defaultVisible: true,
        compactLabel: true,
      },
      {
        key: "roles",
        header: t("columns.roles"),
        accessor: (row) =>
          row.role_summary ? (
            <span className="text-xs text-muted-foreground truncate">{row.role_summary}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        defaultVisible: true,
      },
      {
        key: "expires_at",
        header: t("columns.expires"),
        accessor: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "—"}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
    ],
    [t]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "multi-select",
        key: "status",
        label: t("filters.status"),
        options: [
          { label: t("statusLabels.pending"), value: "pending" },
          { label: t("statusLabels.accepted"), value: "accepted" },
          { label: t("statusLabels.declined"), value: "declined" },
          { label: t("statusLabels.cancelled"), value: "cancelled" },
          { label: t("statusLabels.expired"), value: "expired" },
        ],
      },
    ],
    [t]
  );

  const renderCompactItem = useCallback(
    (row: OrgInvitation) => (
      <div className="flex items-center gap-2 py-0.5">
        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{row.email}</span>
        <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} className="shrink-0 text-xs">
          {t(`statusLabels.${row.status}` as Parameters<typeof t>[0]) ?? row.status}
        </Badge>
      </div>
    ),
    [t]
  );

  const renderDetail = useCallback(
    (inv: OrgInvitation) => (
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
    ),
    [t, canCreate, canCancel, isPending]
  );

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("dialogTitle")}</h2>
          </div>
          {canCreate && (
            <Button
              onClick={() => {
                resetDialog();
                setShowInviteDialog(true);
              }}
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("inviteMemberButton")}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <DataView<OrgInvitation, OrgInvitation>
            entity="org-invitations"
            columns={columns}
            filters={filters}
            initialData={initialData}
            queryKey={INVITATIONS_DV_KEY}
            listFetcher={listFetcher}
            detailFetcher={detailFetcher}
            getRowId={(row) => row.id}
            renderCompactItem={renderCompactItem}
            renderDetail={renderDetail}
            className="h-full"
          />
        </div>
      </div>

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
    </>
  );
}
