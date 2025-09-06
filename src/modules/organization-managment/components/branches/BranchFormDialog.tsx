"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/stores/app-store";
import { createBranchAction, updateBranchAction } from "@/app/actions/branches";
import { toast } from "react-toastify";
import { Tables } from "../../../../../supabase/types/types";

type Branch = Tables["branches"]["Row"];

const branchFormSchema = z.object({
  name: z
    .string()
    .min(1, "Branch name is required")
    .min(2, "Branch name must be at least 2 characters")
    .max(100, "Branch name must be less than 100 characters"),
  slug: z
    .string()
    .optional()
    .refine((slug) => {
      if (!slug || slug.trim() === "") return true;
      return /^[a-z0-9-]+$/.test(slug);
    }, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

type BranchFormData = z.infer<typeof branchFormSchema>;

interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
  onSuccess?: () => void;
}

export default function BranchFormDialog({
  open,
  onOpenChange,
  branch,
  onSuccess,
}: BranchFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { activeOrg } = useAppStore();
  const isEditing = !!branch;

  const form = useForm<BranchFormData>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  // Reset form when dialog opens/closes or branch changes
  React.useEffect(() => {
    if (open) {
      if (branch) {
        form.reset({
          name: branch.name || "",
          slug: branch.slug || "",
        });
      } else {
        form.reset({
          name: "",
          slug: "",
        });
      }
    }
  }, [open, branch, form]);

  const onSubmit = async (data: BranchFormData) => {
    if (!activeOrg?.id) {
      toast.error("No active organization found");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      if (isEditing && branch) {
        // Update existing branch
        result = await updateBranchAction(branch.id, {
          name: data.name,
          slug: data.slug || undefined,
        });
      } else {
        // Create new branch
        result = await createBranchAction({
          name: data.name,
          slug: data.slug || undefined,
          organization_id: activeOrg.organization_id,
        });
      }

      if (result.success) {
        toast.success(isEditing ? "Branch updated successfully" : "Branch created successfully");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "An error occurred");
      }
    } catch (error) {
      console.error("Error submitting branch form:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  };

  const handleNameChange = (name: string) => {
    const currentSlug = form.getValues("slug");

    // Auto-generate slug only if it's empty or if we're creating a new branch
    if (!isEditing && !currentSlug) {
      const generatedSlug = generateSlugFromName(name);
      form.setValue("slug", generatedSlug);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isEditing ? "Edit Branch" : "Create New Branch"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the branch information below."
              : "Create a new branch for your organization."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Main Office, Downtown Branch"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleNameChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>The display name for this branch</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., main-office, downtown-branch" {...field} />
                  </FormControl>
                  <FormDescription>
                    URL-friendly identifier. Only lowercase letters, numbers, and hyphens allowed.
                    {!isEditing && " Auto-generated from name if left empty."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Branch" : "Create Branch"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
