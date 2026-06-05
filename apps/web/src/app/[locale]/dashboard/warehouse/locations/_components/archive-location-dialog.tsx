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
import { AlertTriangle } from "lucide-react";
import type { ArchiveBlocker, ArchiveWarning } from "@/lib/types/warehouse/locations-v2";

interface ArchiveLocationDialogProps {
  locationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  blockers?: ArchiveBlocker[];
  warnings?: ArchiveWarning[];
}

export function ArchiveLocationDialog({
  locationName,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  blockers = [],
  warnings = [],
}: ArchiveLocationDialogProps) {
  const isBlocked = blockers.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBlocked ? "Cannot archive location" : "Archive location?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isBlocked ? (
                <>
                  <p>
                    <span className="font-semibold">{locationName}</span> cannot be archived
                    because:
                  </p>
                  <ul className="space-y-1.5">
                    {blockers.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <span className="text-destructive">{b.message}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground text-sm">
                    Resolve the issues above before archiving.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Archive <span className="font-semibold">{locationName}</span>? This will disable
                    the location for future inventory use.
                  </p>
                  {warnings.length > 0 && (
                    <ul className="space-y-1.5">
                      {warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{w.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-muted-foreground text-sm">
                    Historical records, QR codes, and movements are preserved. You can unarchive
                    later by setting status back to active.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{isBlocked ? "Close" : "Cancel"}</AlertDialogCancel>
          {!isBlocked && (
            <AlertDialogAction
              onClick={onConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Archiving…" : "Archive location"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
