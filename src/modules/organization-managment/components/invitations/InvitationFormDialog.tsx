"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Shield, Calendar, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createInvitationAction } from "@/app/actions/organization/invitations";
import { useTranslations } from "next-intl";
import { useRoles } from "@/hooks/useRoles";
import { toast } from "react-toastify";

const invitationSchema = z.object({
  email: z.string().min(1).email().toLowerCase(),
  // role_id is optional — org_member base role is always assigned on acceptance
  role_id: z.string().uuid().optional().or(z.literal("")),
  expires_at: z.string().optional(),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface InvitationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InvitationFormDialog({ open, onOpenChange, onSuccess }: InvitationFormDialogProps) {
  const t = useTranslations("invitationFormDialog");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { roles, loading: rolesLoading } = useRoles();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: "", role_id: "", expires_at: "" },
  });

  const watchedRoleId = watch("role_id");

  React.useEffect(() => {
    if (!open) {
      reset();
      setError(null);
    }
  }, [open, reset]);

  React.useEffect(() => {
    if (open) {
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() + 7);
      setValue("expires_at", sevenDays.toISOString().split("T")[0]);
    }
  }, [open, setValue]);

  const onSubmit = async (data: InvitationFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        email: data.email,
        // Send null when no role chosen — org_member is assigned automatically
        role_id: data.role_id && data.role_id.length > 0 ? data.role_id : null,
        branch_id: null,
        expires_at: data.expires_at
          ? new Date(data.expires_at + "T23:59:59").toISOString()
          : undefined,
      };

      const result = await createInvitationAction(payload);

      if (result.success) {
        toast.success(t("successToast"));
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(("error" in result ? result.error : undefined) || t("errorFallback"));
      }
    } catch (err) {
      console.error("[InvitationFormDialog] Error creating invitation:", err);
      setError(t("errorFallback"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exclude system and owner roles from the optional selector
  const assignableRoles = roles.filter(
    (role) => role.name !== "org_owner" && !role.name.includes("system")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Label htmlFor="email">
              {t("emailLabel")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              {...register("email")}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <Label htmlFor="role_id">
              {t("roleLabel")}
              <span className="ml-1 text-xs text-muted-foreground">{t("roleOptionalHint")}</span>
            </Label>
            <Select
              value={watchedRoleId ?? ""}
              onValueChange={(value) => setValue("role_id", value === "__none__" ? "" : value)}
              disabled={isSubmitting || rolesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={rolesLoading ? t("roleLoading") : t("rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {/* Explicit "no extra role" choice */}
                <SelectItem value="__none__">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("roleNoneLabel")}</span>
                  </div>
                </SelectItem>
                {assignableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>{(role as { display_name?: string }).display_name || role.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("roleBaseHint")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <Label htmlFor="expires_at">{t("expiresLabel")}</Label>
            <Input
              id="expires_at"
              type="date"
              {...register("expires_at")}
              disabled={isSubmitting}
              min={new Date().toISOString().split("T")[0]}
            />
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {t("expiresHint")}
            </p>
          </motion.div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("cancelButton")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("pendingButton")}
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  {t("submitButton")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
