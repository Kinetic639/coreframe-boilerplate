import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type SidebarMode = "manual" | "auto";
type SectionMode = "single" | "multi";

interface SidebarStoreState {
  // Sidebar behavior modes
  mode: SidebarMode;
  sectionMode: SectionMode;

  // Section management
  openSections: string[];
  availableSections: string[]; // All available section IDs for expand all
  activeSectionId: string | null; // Section containing the current page
  activeItemPath: string | null; // Currently active menu item path

  // Actions
  setMode: (mode: SidebarMode) => void;
  setSectionMode: (mode: SectionMode) => void;
  toggleSection: (sectionId: string) => void;
  setSections: (sections: string[]) => void;
  setAvailableSections: (sections: string[]) => void;
  setActiveSectionId: (sectionId: string | null) => void;
  setActiveItemPath: (path: string | null) => void;
  collapseAllSections: () => void;
  expandAllSections: () => void;
  toggleExpandCollapseAll: () => void;

  // Initialize state on app load
  initializeSidebar: (pathname: string) => void;
}

const SIDEBAR_STORAGE_KEY = "sidebar_state";

export const useSidebarStore = create<SidebarStoreState>()(
  persist(
    (set, get) => ({
      // Sidebar behavior modes
      mode: "manual" as SidebarMode, // Default to manual mode
      sectionMode: "single" as SectionMode, // Default to single-open mode

      // Section management
      openSections: [], // Track which accordion sections are open
      availableSections: [], // All available section IDs
      activeSectionId: null, // Section containing the current page
      activeItemPath: null, // Currently active menu item path

      // Actions
      setMode: (mode: SidebarMode) => set({ mode }),
      setSectionMode: (mode: SectionMode) => {
        set({ sectionMode: mode });
        // When switching to single mode, auto-collapse all sections except active
        if (mode === "single") {
          const { activeSectionId } = get();
          if (activeSectionId) {
            set({ openSections: [activeSectionId] });
          } else {
            set({ openSections: [] });
          }
        }
      },
      setActiveItemPath: (path: string | null) => set({ activeItemPath: path }),
      toggleSection: (sectionId: string) => {
        const { openSections, sectionMode } = get();
        const isOpen = openSections.includes(sectionId);

        if (sectionMode === "single") {
          if (isOpen) {
            // Close the section
            set({
              openSections: openSections.filter((id) => id !== sectionId),
            });
          } else {
            // In single mode, only allow one main module section to be open
            if (sectionId.startsWith("module-")) {
              // This is a module section - close all other module sections
              const newOpenSections = openSections.filter((id) => !id.startsWith("module-"));
              set({ openSections: [...newOpenSections, sectionId] });
            } else {
              // This is a nested section - just open it (parent module should already be open)
              set({ openSections: [...openSections, sectionId] });
            }
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
        if (activeSectionId) {
          set({ openSections: [activeSectionId] });
        } else {
          set({ openSections: [] });
        }
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

      // Initialize sidebar state based on current path and modules
      initializeSidebar: (pathname: string) => {
        const state = get();

        // Update active item path
        set({ activeItemPath: pathname });

        // Auto-expand the section containing the active item if in single mode
        if (state.sectionMode === "single" && state.activeSectionId) {
          const currentOpenSections = state.openSections;
          if (!currentOpenSections.includes(state.activeSectionId)) {
            set({ openSections: [state.activeSectionId] });
          }
        }
      },
    }),
    {
      name: SIDEBAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist all relevant state except activeItemPath (which should be updated on navigation)
      partialize: (state) => ({
        mode: state.mode,
        sectionMode: state.sectionMode,
        openSections: state.openSections,
        availableSections: state.availableSections,
        activeSectionId: state.activeSectionId,
        // Don't persist activeItemPath as it should be set on navigation
      }),
      // Merge persisted state with defaults for any missing properties
      merge: (persistedState: any, currentState: SidebarStoreState) => ({
        ...currentState,
        ...persistedState,
        // Always start with null activeItemPath on hydration
        activeItemPath: null,
      }),
    }
  )
);

export type { SidebarMode, SectionMode };
