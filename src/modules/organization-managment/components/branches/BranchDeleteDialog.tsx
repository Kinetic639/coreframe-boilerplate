"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { deleteBranchAction } from "@/app/actions/branches";
import { toast } from "react-toastify";
import { Tables } from "../../../../../supabase/types/types";

type Branch = Tables["branches"]["Row"];

interface BranchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
  onSuccess?: () => void;
}

export default function BranchDeleteDialog({
  open,
  onOpenChange,
  branch,
  onSuccess,
}: BranchDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!branch) return;

    setIsDeleting(true);

    try {
      const result = await deleteBranchAction(branch.id);

      if (result.success) {
        toast.success("Branch deleted successfully");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to delete branch");
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Branch
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the branch "{branch?.name}"?
            <br />
            <br />
            <strong>This action cannot be undone.</strong> The branch will be permanently removed
            and any data associated with it may be affected.
            <br />
            <br />
            <em>Note: You cannot delete a branch that has users assigned to it.</em>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Branch
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
