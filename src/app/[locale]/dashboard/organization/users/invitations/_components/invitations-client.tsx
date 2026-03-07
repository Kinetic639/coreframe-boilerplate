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
import { Mail, Send, X, RefreshCw, Plus, Trash2, AlertCircle } from "lucide-react";
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

interface InvitationRoleRow {
  role_id: string;
  scope: "org" | "branch";
  scope_id: string | null;
}

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
  const [roleRows, setRoleRows] = useState<InvitationRoleRow[]>([]);
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
    setRoleRows([]);
    setDialogError(null);
  };

  const handleOpenDialog = () => {
    resetDialog();
    setShowInviteDialog(true);
  };

  const handleAddRole = () => {
    setRoleRows((prev) => [...prev, { role_id: "", scope: "org", scope_id: null }]);
  };

  const handleRemoveRole = (idx: number) => {
    setRoleRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRoleChange = (idx: number, roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    const defaultScope: "org" | "branch" = role?.scope_type === "branch" ? "branch" : "org";
    setRoleRows((prev) =>
      prev.map((row, i) =>
        i === idx ? { role_id: roleId, scope: defaultScope, scope_id: null } : row
      )
    );
  };

  const handleBranchChange = (idx: number, branchId: string) => {
    setRoleRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, scope_id: branchId || null } : row))
    );
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    setDialogError(null);

    const validRoleRows = roleRows.filter((r) => r.role_id);

    createMutation.mutate(
      {
        email: email.trim(),
        role_assignments:
          validRoleRows.length > 0
            ? validRoleRows.map((r) => ({
                role_id: r.role_id,
                scope: r.scope,
                scope_id: r.scope === "branch" ? r.scope_id : null,
              }))
            : undefined,
      },
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
                <div className="flex items-center justify-between">
                  <Label>{t("rolesLabel")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRole}
                    disabled={isPending}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t("addRoleButton")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("rolesHint")}</p>

                {roleRows.map((row, idx) => {
                  const selectedRole = roles.find((r) => r.id === row.role_id);
                  const needsBranch =
                    selectedRole?.scope_type === "branch" || selectedRole?.scope_type === "both";

                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={row.role_id}
                          onValueChange={(v) => handleRoleChange(idx, v)}
                          disabled={isPending}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("roleSelectPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {assignableRoles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}{" "}
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({r.scope_type})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {needsBranch && activeBranches.length > 0 && (
                          <Select
                            value={row.scope_id ?? ""}
                            onValueChange={(v) => handleBranchChange(idx, v)}
                            disabled={isPending}
                          >
                            <SelectTrigger>
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
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-destructive hover:text-destructive mt-0"
                        onClick={() => handleRemoveRole(idx)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
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
