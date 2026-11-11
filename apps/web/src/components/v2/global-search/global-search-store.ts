import { create } from "zustand";

interface GlobalSearchState {
  open: boolean;
  /** Text the palette opens with (e.g. ">" for the actions mode) */
  initialQuery: string;
  /** Open straight into the camera (the header's scan button on phones) */
  scanOnOpen: boolean;
  setOpen: (open: boolean, initialQuery?: string) => void;
  /** Open the palette in the scanner */
  openScanner: () => void;
  toggle: () => void;
}

/** Open state of the global search palette, shared by its triggers and the dialog */
export const useGlobalSearchStore = create<GlobalSearchState>((set) => ({
  open: false,
  initialQuery: "",
  scanOnOpen: false,
  setOpen: (open, initialQuery = "") => set({ open, initialQuery, scanOnOpen: false }),
  openScanner: () => set({ open: true, initialQuery: "", scanOnOpen: true }),
  toggle: () => set((state) => ({ open: !state.open, initialQuery: "", scanOnOpen: false })),
}));
