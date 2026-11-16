"use client";

import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";

/** How long the "Undo" button stays on screen. */
const UNDO_TOAST_MS = 7000;

/** A success toast with an Undo button (archiving a card or a column). */
export function toastWithUndo(message: string, undoLabel: string, onUndo: () => void) {
  toast.success(
    ({ closeToast }) => (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-sm">{message}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0"
          onClick={() => {
            closeToast?.();
            onUndo();
          }}
        >
          {undoLabel}
        </Button>
      </div>
    ),
    { autoClose: UNDO_TOAST_MS }
  );
}
