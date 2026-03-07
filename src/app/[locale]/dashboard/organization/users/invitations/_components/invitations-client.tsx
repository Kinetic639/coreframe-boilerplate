"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { usePermissions } from "@/hooks/v2/use-permissions";
import { INVITES_CREATE, INVITES_CANCEL } from "@/lib/constants/permissions";
import {
  useInvitationsQuery,
  useCreateInvitationMutation,
  useCancelInvitationMutation,
  useResendInvitationMutation,
  useRolesQuery,
  useBranchesQuery,
} from "@/hooks/queries/organization";
import type { OrgInvitation, OrgRole, OrgBranch } from "@/server/services/organization.service";

interface InvitationsClientProps {
  initialInvitations: OrgInvitation[];
  initialRoles: OrgRole[];
  initialBranches: OrgBranch[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accepted: "default",
  cancelled: "secondary",
  expired: "destructive",
  declined: "secondary",
};

export function InvitationsClient({
  initialInvitations,
  initialRoles,
  initialBranches,
}: InvitationsClientProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const t = useTranslations("adminInvitations");

  const { data: invitations } = useInvitationsQuery(initialInvitations);
  const { data: roles } = useRolesQuery(initialRoles);
  const { data: branches } = useBranchesQuery(initialBranches);
  const createMutation = useCreateInvitationMutation();
  const cancelMutation = useCancelInvitationMutation();
  const resendMutation = useResendInvitationMutation();

  const isPending =
    createMutation.isPending || cancelMutation.isPending || resendMutation.isPending;

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleScopeConfigs, setRoleScopeConfigs] = useState<
    Map<string, { scope: "org" | "branch"; branchId: string | null }>
  >(new Map());
  const [dialogError, setDialogError] = useState<string | null>(null);

  const canCreate = can(INVITES_CREATE);
  const canCancel = can(INVITES_CANCEL);

  // Non-basic roles only (org_member/org_owner are assigned automatically)
  const assignableRoles = roles.filter((r) => !r.is_basic && !r.deleted_at);
  const activeBranches = branches.filter((b) => !b.deleted_at);

  const INVITE_ERROR_KEYS: Record<string, string> = {
    DUPLICATE_PENDING: t("inviteErrors.DUPLICATE_PENDING"),
    ALREADY_MEMBER: t("inviteErrors.ALREADY_MEMBER"),
    ALREADY_IN_ORG: t("inviteErrors.ALREADY_IN_ORG"),
    SELF_INVITE: t("inviteErrors.SELF_INVITE"),
    UNAUTHORIZED: t("inviteErrors.UNAUTHORIZED"),
    INVALID_EMAIL: t("inviteErrors.INVALID_EMAIL"),
  };

  const mapInviteError = (raw: string): string =>
    INVITE_ERROR_KEYS[raw] ?? t("inviteErrors.UNKNOWN");

  const resetDialog = () => {
    setEmail("");
    setSelectedRoleIds([]);
    setRoleScopeConfigs(new Map());
    setDialogError(null);
  };

  const handleOpenDialog = () => {
    resetDialog();
    setShowInviteDialog(true);
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
        new Map(prev).set(roleId, { scope: defaultScope, branchId: null })
      );
    }
  };

  const setRoleScope = (roleId: string, scope: "org" | "branch") => {
    setRoleScopeConfigs((prev) => new Map(prev).set(roleId, { scope, branchId: null }));
  };

  const setRoleBranch = (roleId: string, branchId: string) => {
    setRoleScopeConfigs((prev) => {
      const existing = prev.get(roleId) ?? { scope: "branch" as const, branchId: null };
      return new Map(prev).set(roleId, { ...existing, branchId: branchId || null });
    });
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    setDialogError(null);

    const role_assignments =
      selectedRoleIds.length > 0
        ? selectedRoleIds.map((roleId) => {
            const config = roleScopeConfigs.get(roleId);
            return {
              role_id: roleId,
              scope: config?.scope ?? "org",
              scope_id: config?.scope === "branch" ? config.branchId : null,
            };
          })
        : undefined;

    createMutation.mutate(
      { email: email.trim(), role_assignments },
      {
        onSuccess: () => {
          resetDialog();
          setShowInviteDialog(false);
          router.refresh();
        },
        onError: (err: Error) => {
          setDialogError(mapInviteError(err.message));
        },
      }
    );
  };

  const handleCancel = (invitation: OrgInvitation) => {
    cancelMutation.mutate({ invitationId: invitation.id });
  };

  const handleResend = (invitation: OrgInvitation) => {
    resendMutation.mutate({ invitationId: invitation.id });
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={handleOpenDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t("inviteMemberButton")}
          </Button>
        </div>
      )}

      {invitations.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t("noInvitations")}</div>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => {
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    {inv.role_summary && (
                      <p className="text-xs text-muted-foreground">{inv.role_summary}</p>
                    )}
                    {inv.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        {t("expiresLabel")} {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>{inv.status}</Badge>
                  {inv.status === "pending" && (
                    <>
                      {canCreate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isPending}
                          onClick={() => handleResend(inv)}
                          title={t("resendTitle")}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={isPending}
                          onClick={() => handleCancel(inv)}
                          title={t("cancelTitle")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Email */}
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
                placeholder="colleague@example.com"
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                disabled={isPending}
              />
            </div>

            {/* Role assignments */}
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
                                  branch
                                </Badge>
                              )}
                              {role.scope_type === "both" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs py-0 text-purple-600 border-purple-300"
                                >
                                  both
                                </Badge>
                              )}
                            </div>
                            {role.description && (
                              <p className="text-xs text-muted-foreground">{role.description}</p>
                            )}
                          </Label>
                        </div>

                        {/* Scope toggle for 'both' roles */}
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
                              Org
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={config?.scope === "branch" ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => setRoleScope(role.id, "branch")}
                              disabled={isPending}
                            >
                              Branch
                            </Button>
                          </div>
                        )}

                        {/* Branch selector for branch-scoped roles */}
                        {showBranchSelector && activeBranches.length > 0 && (
                          <div className="ml-7">
                            <Select
                              value={config?.branchId ?? ""}
                              onValueChange={(v) => setRoleBranch(role.id, v)}
                              disabled={isPending}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder={t("branchSelectPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                {activeBranches.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
    </div>
  );
}
