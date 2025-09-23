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
import { Loader2, UserPlus } from "lucide-react";
import { assignUserRole } from "@/app/actions/roles";
import { useRoles } from "@/hooks/useRoles";
import { fetchOrganizationUsers } from "@/lib/api/roles";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";
import { useEffect } from "react";

const assignRoleSchema = z.object({
  user_id: z.string().min(1, "Please select a user"),
  role_id: z.string().min(1, "Please select a role"),
  scope: z.enum(["org", "branch"], { message: "Please select a scope" }),
  scope_id: z.string().min(1, "Scope ID is required"),
});

type AssignRoleFormData = z.infer<typeof assignRoleSchema>;

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status_id: string;
  created_at: string;
}

interface RoleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RoleAssignmentDialog({ open, onOpenChange, onSuccess }: RoleAssignmentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { roles } = useRoles();
  const { activeOrg, activeBranch } = useAppStore();

  const form = useForm<AssignRoleFormData>({
    resolver: zodResolver(assignRoleSchema),
    defaultValues: {
      scope: "org",
      scope_id: (activeOrg as any)?.id || (activeOrg as any)?.organization_id || "",
    },
  });

  // Load users when dialog opens
  useEffect(() => {
    if (open && ((activeOrg as any)?.id || (activeOrg as any)?.organization_id)) {
      setLoadingUsers(true);
      fetchOrganizationUsers((activeOrg as any).organization_id)
        .then(setUsers as any)
        .catch((error) => {
          console.error("Failed to fetch users:", error);
          toast.error("Failed to load users");
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [open, (activeOrg as any)?.id]);

  // Update scope_id when scope changes
  const watchScope = form.watch("scope");
  useEffect(() => {
    if (watchScope === "org" && (activeOrg as any)?.id) {
      form.setValue("scope_id", (activeOrg as any).organization_id);
    } else if (watchScope === "branch" && activeBranch?.id) {
      form.setValue("scope_id", activeBranch.id);
    }
  }, [watchScope, (activeOrg as any)?.id, activeBranch?.id, form]);

  async function onSubmit(data: AssignRoleFormData) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          formData.append(key, value);
        });

        const result = await assignUserRole(null, formData);

        if (result.success) {
          toast.success("Role assigned successfully");
          form.reset();
          onOpenChange(false);
          onSuccess?.();
        } else if (result.error) {
          toast.error(result.error);
        } else if (result.errors) {
          // Handle validation errors
          Object.entries(result.errors).forEach(([field, errors]) => {
            form.setError(field as keyof AssignRoleFormData, {
              message: errors[0],
            });
          });
        }
      } catch (error) {
        console.error("Failed to assign role:", error);
        toast.error("Failed to assign role");
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
            <UserPlus className="h-5 w-5" />
            Assign Role to User
          </DialogTitle>
          <DialogDescription>
            Assign a role to a user within the selected scope. This will grant them the permissions
            associated with that role.
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
              name="role_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <span>{role.name}</span>
                            {role.is_basic && (
                              <span className="text-xs text-muted-foreground">(System)</span>
                            )}
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
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="org">Organization</SelectItem>
                      <SelectItem value="branch" disabled={!activeBranch}>
                        Branch {!activeBranch && "(No active branch)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    Assigning...
                  </>
                ) : (
                  "Assign Role"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
