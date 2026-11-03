import { create } from "zustand";

/**
 * Opens the report dialog from anywhere (user menu, global search); the
 * dialog itself is mounted once in the dashboard header.
 */
export const useReportFeedbackStore = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
