"use client";

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

interface RemoveFromMapDialogProps {
  locationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function RemoveFromMapDialog({
  locationName,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: RemoveFromMapDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from map?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This will remove the visual representation of{" "}
              <span className="font-semibold">{locationName}</span> from the top-down plan.
            </span>
            <span className="block text-emerald-700 font-medium">
              The location, its inventory, QR code, and history are not affected.
            </span>
            <span className="block text-muted-foreground">
              You can place it back on the map at any time from the Unmapped Locations panel.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? "Removing…" : "Remove from map"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
