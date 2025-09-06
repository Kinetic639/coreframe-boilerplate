"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Key, Shield, ShieldCheck, ShieldX } from "lucide-react";
import { createPermissionOverride } from "@/app/actions/roles";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchOrganizationUsers } from "@/lib/api/roles";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";
import { useEffect } from "react";

const permissionOverrideSchema = z.object({
  user_id: z.string().min(1, "Please select a user"),
  permission_id: z.string().min(1, "Please select a permission"),
  organization_id: z.string().min(1, "Organization ID is required"),
  is_granted: z.boolean(),
});

type PermissionOverrideFormData = z.infer<typeof permissionOverrideSchema>;

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status_id: string;
  created_at: string;
}

interface PermissionOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  selectedUserId?: string | null;
}

export function PermissionOverrideDialog({
  open,
  onOpenChange,
  onSuccess,
  selectedUserId,
}: PermissionOverrideDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { permissions } = usePermissions();
  const { activeOrg } = useAppStore();

  const form = useForm<PermissionOverrideFormData>({
    resolver: zodResolver(permissionOverrideSchema),
    defaultValues: {
      organization_id: (activeOrg as any)?.id || (activeOrg as any)?.organization_id || "",
      is_granted: true,
      user_id: selectedUserId || "",
    },
  });

  // Load users when dialog opens
  useEffect(() => {
    if ((open && (activeOrg as any)?.id) || (activeOrg as any)?.organization_id) {
      setLoadingUsers(true);
      fetchOrganizationUsers(activeOrg.organization_id)
        .then(setUsers as any)
        .catch((error) => {
          console.error("Failed to fetch users:", error);
          toast.error("Failed to load users");
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [open, (activeOrg as any)?.id || (activeOrg as any)?.organization_id]);

  // Set selected user if provided
  useEffect(() => {
    if (selectedUserId) {
      form.setValue("user_id", selectedUserId);
    }
  }, [selectedUserId, form]);

  async function onSubmit(data: PermissionOverrideFormData) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          formData.append(key, value.toString());
        });

        const result = await createPermissionOverride(null, formData);

        if (result.success) {
          toast.success("Permission override created successfully");
          form.reset({
            organization_id: (activeOrg as any)?.id || (activeOrg as any)?.organization_id || "",
            is_granted: true,
            user_id: selectedUserId || "",
          });
          onOpenChange(false);
          onSuccess?.();
        } else if (result.error) {
          toast.error(result.error);
        } else if (result.errors) {
          // Handle validation errors
          Object.entries(result.errors).forEach(([field, errors]) => {
            form.setError(field as keyof PermissionOverrideFormData, {
              message: errors[0],
            });
          });
        }
      } catch (error) {
        console.error("Failed to create permission override:", error);
        toast.error("Failed to create permission override");
      }
    });
  }

  const getUserDisplayName = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name} (${user.email})`;
    }
    return user.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Create Permission Override
          </DialogTitle>
          <DialogDescription>
            Grant or deny a specific permission for a user, overriding their role-based permissions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingUsers ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2">Loading users...</span>
                        </div>
                      ) : users.length === 0 ? (
                        <div className="py-2 text-center text-sm text-muted-foreground">
                          No users found
                        </div>
                      ) : (
                        users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {getUserDisplayName(user)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permission_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permission</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a permission" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {permissions.map((permission) => (
                        <SelectItem key={permission.id} value={permission.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{permission.label}</span>
                            <span className="text-xs text-muted-foreground">{permission.slug}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_granted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-2 text-base">
                      {field.value ? (
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                      ) : (
                        <ShieldX className="h-4 w-4 text-red-600" />
                      )}
                      {field.value ? "Grant Permission" : "Deny Permission"}
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      {field.value
                        ? "The user will have this permission regardless of their role"
                        : "The user will NOT have this permission even if their role grants it"}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Permission overrides take precedence over role-based
                  permissions. Use them sparingly and only when necessary for specific user
                  requirements.
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Override"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
