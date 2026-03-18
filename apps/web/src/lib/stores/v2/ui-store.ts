import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

/**
 * UI Store State
 *
 * Local-only model with timestamps for future auto-sync upgrade path.
 * All UI changes are immediate (no server wait).
 */
interface UiStoreV2State {
  // UI values
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: Theme;
  colorTheme: string;

  // Sync metadata (persisted)
  _lastLocalChangeAt: string | null; // Updated on every setter - tracks local changes

  // Transient (not persisted)
  _syncVersion: number; // Counter for change detection (future auto-sync)
  _hasHydrated: boolean; // True after Zustand hydrates from localStorage
}

interface UiStoreV2Actions {
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: string) => void;

  /** Called by onRehydrateStorage when localStorage is loaded */
  _setHasHydrated: (v: boolean) => void;

  /** Reset all UI settings to defaults */
  resetToDefaults: () => void;

  /** Hydrate UI state from server (used by manual Load from cloud) */
  hydrateFromServer: (settings: {
    theme?: Theme;
    colorTheme?: string;
    sidebarCollapsed?: boolean;
  }) => void;

  /** Get current UI settings for sync (future auto-sync ready) */
  getSettingsForSync: () => {
    theme: Theme;
    colorTheme: string;
    sidebarCollapsed: boolean;
    clientUpdatedAt: string;
  };
}

const DEFAULT_STATE = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: "system" as Theme,
  colorTheme: "default",
};

export const useUiStoreV2 = create<UiStoreV2State & UiStoreV2Actions>()(
  persist(
    (set, get) => ({
      // Initial state
      ...DEFAULT_STATE,
      _lastLocalChangeAt: null,
      _syncVersion: 0,
      _hasHydrated: false,

      _setHasHydrated: (v) => set({ _hasHydrated: v }),

      setSidebarOpen: (open) =>
        set((state) => ({
          sidebarOpen: open,
          _lastLocalChangeAt: new Date().toISOString(),
          _syncVersion: state._syncVersion + 1,
        })),

      setSidebarCollapsed: (collapsed) =>
        set((state) => ({
          sidebarCollapsed: collapsed,
          _lastLocalChangeAt: new Date().toISOString(),
          _syncVersion: state._syncVersion + 1,
        })),

      setTheme: (theme) =>
        set((state) => ({
          theme,
          _lastLocalChangeAt: new Date().toISOString(),
          _syncVersion: state._syncVersion + 1,
        })),

      setColorTheme: (colorTheme) =>
        set((state) => ({
          colorTheme,
          _lastLocalChangeAt: new Date().toISOString(),
          _syncVersion: state._syncVersion + 1,
        })),

      resetToDefaults: () =>
        set((state) => ({
          ...DEFAULT_STATE,
          _lastLocalChangeAt: new Date().toISOString(),
          _syncVersion: state._syncVersion + 1,
        })),

      hydrateFromServer: (settings) => {
        if (!settings) return;
        set({
          ...(settings.theme !== undefined && { theme: settings.theme }),
          ...(settings.colorTheme !== undefined && {
            colorTheme: settings.colorTheme,
          }),
          ...(settings.sidebarCollapsed !== undefined && {
            sidebarCollapsed: settings.sidebarCollapsed,
          }),
          // Don't update _lastLocalChangeAt - this is a server hydration, not a local change
        });
      },

      getSettingsForSync: () => {
        const state = get();
        return {
          theme: state.theme,
          colorTheme: state.colorTheme,
          sidebarCollapsed: state.sidebarCollapsed,
          clientUpdatedAt: new Date().toISOString(),
        };
      },
    }),
    {
      name: "ui-store-v2",
      onRehydrateStorage: () => (state) => {
        // Called when Zustand finishes hydrating from localStorage
        state?._setHasHydrated(true);
      },
      // Persist UI values + _lastLocalChangeAt. Don't persist _syncVersion or _hasHydrated (transient).
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        colorTheme: state.colorTheme,
        _lastLocalChangeAt: state._lastLocalChangeAt,
      }),
    }
  )
);

/**
 * Selector for sync-related state (future auto-sync ready)
 */
export const selectUiSyncState = (state: UiStoreV2State) => ({
  theme: state.theme,
  colorTheme: state.colorTheme,
  sidebarCollapsed: state.sidebarCollapsed,
  _lastLocalChangeAt: state._lastLocalChangeAt,
  _syncVersion: state._syncVersion,
});
