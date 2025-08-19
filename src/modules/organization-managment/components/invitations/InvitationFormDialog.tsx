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
import { Loader2, Mail, Shield, Building2, Calendar, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createInvitationAction, type CreateInvitationFormData } from "@/app/actions/invitations";
import { useAppStore } from "@/lib/stores/app-store";
import { useRoles } from "@/hooks/useRoles";

const invitationSchema = z.object({
  email: z.string().min(1, "Email jest wymagany").email("Nieprawidłowy format email").toLowerCase(),
  role_id: z.string().min(1, "Rola jest wymagana"),
  branch_id: z.string().min(1, "Oddział jest wymagany"),
  expires_at: z.string().optional(),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface InvitationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InvitationFormDialog({ open, onOpenChange, onSuccess }: InvitationFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { availableBranches, activeOrgId } = useAppStore();
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
    defaultValues: {
      email: "",
      role_id: "",
      branch_id: "",
      expires_at: "",
    },
  });

  const watchedBranchId = watch("branch_id");
  const watchedRoleId = watch("role_id");

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      reset();
      setError(null);
    }
  }, [open, reset]);

  // Set default expiry to 7 days from now
  React.useEffect(() => {
    if (open) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      setValue("expires_at", sevenDaysFromNow.toISOString().split("T")[0]);
    }
  }, [open, setValue]);

  const onSubmit = async (data: InvitationFormData) => {
    if (!activeOrgId) {
      setError("Brak aktywnej organizacji");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Convert date to ISO string if provided
      const formattedData: CreateInvitationFormData = {
        ...data,
        expires_at: data.expires_at
          ? new Date(data.expires_at + "T23:59:59").toISOString()
          : undefined,
      };

      const result = await createInvitationAction(formattedData);

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(result.error || "Nie udało się utworzyć zaproszenia");
      }
    } catch (err) {
      console.error("Error creating invitation:", err);
      setError("Wystąpił nieoczekiwany błąd");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter roles that are assignable (not org_owner typically)
  const assignableRoles = roles.filter(
    (role) => role.name !== "org_owner" && !role.name.includes("system")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Zaproś nowego użytkownika
          </DialogTitle>
          <DialogDescription>
            Wyślij zaproszenie do dołączenia do organizacji. Użytkownik otrzyma link do
            zaakceptowania zaproszenia.
          </DialogDescription>
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
              Adres email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="np. jan.kowalski@example.com"
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
              Rola <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watchedRoleId}
              onValueChange={(value) => setValue("role_id", value)}
              disabled={isSubmitting || rolesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={rolesLoading ? "Ładowanie ról..." : "Wybierz rolę"} />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>{role.display_name || role.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role_id && <p className="text-sm text-red-500">{errors.role_id.message}</p>}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <Label htmlFor="branch_id">
              Oddział <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watchedBranchId}
              onValueChange={(value) => setValue("branch_id", value)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz oddział" />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch.branch_id} value={branch.branch_id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{branch.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.branch_id && <p className="text-sm text-red-500">{errors.branch_id.message}</p>}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <Label htmlFor="expires_at">Data wygaśnięcia</Label>
            <Input
              id="expires_at"
              type="date"
              {...register("expires_at")}
              disabled={isSubmitting}
              min={new Date().toISOString().split("T")[0]}
            />
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Zaproszenie wygaśnie o północy w wybranym dniu
            </p>
            {errors.expires_at && (
              <p className="text-sm text-red-500">{errors.expires_at.message}</p>
            )}
          </motion.div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Wyślij zaproszenie
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
