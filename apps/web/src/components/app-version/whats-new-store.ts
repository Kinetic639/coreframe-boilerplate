import { create } from "zustand";

/**
 * Opens the "What's new" window from anywhere (sidebar, user menu, update toast); the
 * window itself is mounted once by AppVersionHost.
 */
export const useWhatsNewStore = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
