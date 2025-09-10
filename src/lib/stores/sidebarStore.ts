import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type SidebarMode = "manual" | "auto";
type SectionMode = "single" | "multi";

interface SidebarState {
  isOpen: boolean;
  mode: SidebarMode;
  sectionMode: SectionMode;
  openSections: string[];
  availableSections: string[]; // All available section IDs for expand all
  activeSectionId: string | null; // Section containing the current page
  toggleSidebar: () => void;
  setOpen: (open: boolean) => void;
  setMode: (mode: SidebarMode) => void;
  setSectionMode: (mode: SectionMode) => void;
  toggleSection: (sectionId: string) => void;
  setSections: (sections: string[]) => void;
  setAvailableSections: (sections: string[]) => void;
  setActiveSectionId: (sectionId: string | null) => void;
  collapseAllSections: () => void;
  expandAllSections: () => void;
  toggleExpandCollapseAll: () => void;
}

const SIDEBAR_STORAGE_KEY = "sidebar_state";

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      isOpen: true, // Default state
      mode: "manual" as SidebarMode, // Default to manual mode
      sectionMode: "single" as SectionMode, // Default to single-open mode
      openSections: [], // Track which accordion sections are open
      availableSections: [], // All available section IDs
      activeSectionId: null, // Section containing the current page
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (open: boolean) => set({ isOpen: open }),
      setMode: (mode: SidebarMode) => set({ mode }),
      setSectionMode: (mode: SectionMode) => set({ sectionMode: mode }),
      toggleSection: (sectionId: string) => {
        const { openSections, sectionMode } = get();
        const isOpen = openSections.includes(sectionId);

        if (sectionMode === "single") {
          if (isOpen) {
            // Close the section and all its children
            const childSections = openSections.filter((id) => id.startsWith(sectionId + "-"));
            set({
              openSections: openSections.filter(
                (id) => id !== sectionId && !childSections.includes(id)
              ),
            });
          } else {
            // Find the level of this section by counting dashes
            const sectionLevel = (sectionId.match(/-/g) || []).length;

            // Close siblings at the same level, but keep parents and unrelated sections
            const newOpenSections = openSections.filter((id) => {
              const idLevel = (id.match(/-/g) || []).length;

              // Keep if it's a parent (less dashes and this section starts with it)
              if (
                idLevel < sectionLevel &&
                sectionId.startsWith(
                  id
                    .split("-")
                    .slice(0, idLevel + 1)
                    .join("-")
                )
              ) {
                return true;
              }

              // Keep if it's not a sibling (different path at same level)
              if (idLevel === sectionLevel) {
                const currentPath = sectionId.split("-").slice(0, -1).join("-");
                const idPath = id.split("-").slice(0, -1).join("-");
                return currentPath !== idPath;
              }

              // Keep if it's at a different level entirely
              return idLevel !== sectionLevel;
            });

            set({ openSections: [...newOpenSections, sectionId] });
          }
        } else {
          // Multi mode - traditional toggle behavior
          if (isOpen) {
            // Close this section and all its children
            const childSections = openSections.filter((id) => id.startsWith(sectionId + "-"));
            set({
              openSections: openSections.filter(
                (id) => id !== sectionId && !childSections.includes(id)
              ),
            });
          } else {
            set({ openSections: [...openSections, sectionId] });
          }
        }
      },
      setSections: (sections: string[]) => set({ openSections: sections }),
      setAvailableSections: (sections: string[]) => set({ availableSections: sections }),
      setActiveSectionId: (sectionId: string | null) => set({ activeSectionId: sectionId }),
      collapseAllSections: () => {
        const { activeSectionId } = get();
        if (!activeSectionId) {
          set({ openSections: [] });
          return;
        }

        // Keep the active section and all its parent sections open
        const activePathSections: string[] = [];
        const parts = activeSectionId.split("-");

        // Build the path: module-warehouse, module-warehouse-products, etc.
        for (let i = 1; i <= parts.length; i++) {
          activePathSections.push(parts.slice(0, i).join("-"));
        }

        set({ openSections: activePathSections });
      },
      expandAllSections: () => {
        const { availableSections } = get();
        set({ openSections: [...availableSections] });
      },
      toggleExpandCollapseAll: () => {
        const { openSections, availableSections, collapseAllSections, expandAllSections } = get();

        // Check if all sections are expanded
        const allExpanded = openSections.length === availableSections.length;

        if (allExpanded) {
          // All are expanded, collapse all except active path
          collapseAllSections();
        } else {
          // Not all are expanded, expand all
          expandAllSections();
        }
      },
    }),
    {
      name: SIDEBAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export type { SidebarMode, SectionMode };
