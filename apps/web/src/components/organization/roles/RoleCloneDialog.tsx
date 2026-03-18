"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Copy, Loader2 } from "lucide-react";
import { cloneRole, type RoleWithPermissions } from "@/app/actions/roles/role-management";

interface RoleCloneDialogProps {
  sourceRole: RoleWithPermissions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function RoleCloneDialog({
  sourceRole,
  open,
  onOpenChange,
  onComplete,
}: RoleCloneDialogProps) {
  const t = useTranslations("organization.roleManagement");

  const [newRoleName, setNewRoleName] = React.useState(`${sourceRole.name} (Copy)`);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await cloneRole(sourceRole.id, newRoleName.trim());

      if (result.success) {
        onComplete();
      } else {
        setError(result.error || "Failed to clone role");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t("cloneRole")}
          </DialogTitle>
          <DialogDescription>
            Create a copy of "{sourceRole.name}" with all its permissions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="newName">{t("roleName")}</Label>
            <Input
              id="newName"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder={t("roleNamePlaceholder")}
              required
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              The new role will inherit all {sourceRole.permissions.filter((p) => p.allowed).length}{" "}
              permissions from "{sourceRole.name}".
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading || !newRoleName.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("cloneRole")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
