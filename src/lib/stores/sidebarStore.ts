import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SidebarState {
  isOpen: boolean;
  openSections: string[];
  toggleSidebar: () => void;
  setOpen: (open: boolean) => void;
  toggleSection: (sectionId: string) => void;
  setSections: (sections: string[]) => void;
}

const SIDEBAR_STORAGE_KEY = "sidebar_state";

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      isOpen: true, // Default state
      openSections: [], // Track which accordion sections are open
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (open: boolean) => set({ isOpen: open }),
      toggleSection: (sectionId: string) => {
        const { openSections } = get();
        const isOpen = openSections.includes(sectionId);
        if (isOpen) {
          set({ openSections: openSections.filter((id) => id !== sectionId) });
        } else {
          set({ openSections: [...openSections, sectionId] });
        }
      },
      setSections: (sections: string[]) => set({ openSections: sections }),
    }),
    {
      name: SIDEBAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
