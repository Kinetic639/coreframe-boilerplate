"use client";

import { useState } from "react";
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
import { Mail, Send, X, RefreshCw, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { INVITES_CREATE, INVITES_CANCEL } from "@/lib/constants/permissions";
import {
  useInvitationsQuery,
  useCreateInvitationMutation,
  useCancelInvitationMutation,
  useResendInvitationMutation,
} from "@/hooks/queries/organization";
import type { OrgInvitation } from "@/server/services/organization.service";

interface InvitationsClientProps {
  initialInvitations: OrgInvitation[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accepted: "default",
  cancelled: "secondary",
  expired: "destructive",
};

export function InvitationsClient({ initialInvitations }: InvitationsClientProps) {
  const router = useRouter();
  const { can } = usePermissions();

  const { data: invitations } = useInvitationsQuery(initialInvitations);
  const createMutation = useCreateInvitationMutation();
  const cancelMutation = useCancelInvitationMutation();
  const resendMutation = useResendInvitationMutation();

  const isPending =
    createMutation.isPending || cancelMutation.isPending || resendMutation.isPending;

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [email, setEmail] = useState("");

  const canCreate = can(INVITES_CREATE);
  const canCancel = can(INVITES_CANCEL);

  const handleInvite = () => {
    if (!email.trim()) return;
    createMutation.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          setEmail("");
          setShowInviteDialog(false);
          router.refresh();
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
          <Button onClick={() => setShowInviteDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>
      )}

      {invitations.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No invitations found.</div>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  {inv.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Expires: {new Date(inv.expires_at).toLocaleDateString()}
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
                        title="Resend"
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
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={isPending || !email.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {isPending ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
