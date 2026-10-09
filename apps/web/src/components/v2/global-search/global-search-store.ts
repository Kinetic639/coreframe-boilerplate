import { create } from "zustand";

interface GlobalSearchState {
  open: boolean;
  /** Text the palette opens with (e.g. ">" for the actions mode) */
  initialQuery: string;
  setOpen: (open: boolean, initialQuery?: string) => void;
  toggle: () => void;
}

/** Open state of the global search palette, shared by its triggers and the dialog */
export const useGlobalSearchStore = create<GlobalSearchState>((set) => ({
  open: false,
  initialQuery: "",
  setOpen: (open, initialQuery = "") => set({ open, initialQuery }),
  toggle: () => set((state) => ({ open: !state.open, initialQuery: "" })),
}));
