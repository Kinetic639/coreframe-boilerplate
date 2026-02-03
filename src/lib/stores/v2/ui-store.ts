import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiStoreV2State {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";
  /** Timestamp of last successful DB sync (ISO string) */
  _lastSyncedAt: string | null;
  /** Version counter for detecting changes since last sync */
  _syncVersion: number;
}

interface UiStoreV2Actions {
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  /** Update last synced timestamp */
  setLastSyncedAt: (timestamp: string) => void;
  /** Hydrate UI state from database (used by UiSettingsSync) */
  hydrateFromDb: (settings: {
    theme?: "light" | "dark" | "system";
    sidebarCollapsed?: boolean;
    updatedAt?: string;
  }) => void;
  /** Get current UI settings for sync */
  getSettingsForSync: () => {
    theme: "light" | "dark" | "system";
    sidebarCollapsed: boolean;
    updatedAt: string;
  };
}

export const useUiStoreV2 = create<UiStoreV2State & UiStoreV2Actions>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: "system",
      _lastSyncedAt: null,
      _syncVersion: 0,

      setSidebarOpen: (open) =>
        set((state) => ({
          sidebarOpen: open,
          _syncVersion: state._syncVersion + 1,
        })),

      setSidebarCollapsed: (collapsed) =>
        set((state) => ({
          sidebarCollapsed: collapsed,
          _syncVersion: state._syncVersion + 1,
        })),

      setTheme: (theme) =>
        set((state) => ({
          theme,
          _syncVersion: state._syncVersion + 1,
        })),

      setLastSyncedAt: (timestamp) =>
        set({
          _lastSyncedAt: timestamp,
        }),

      hydrateFromDb: (settings) => {
        // Only update if DB has data
        if (!settings) return;

        set((state) => ({
          ...(settings.theme !== undefined && { theme: settings.theme }),
          ...(settings.sidebarCollapsed !== undefined && {
            sidebarCollapsed: settings.sidebarCollapsed,
          }),
          _lastSyncedAt: settings.updatedAt || state._lastSyncedAt,
        }));
      },

      getSettingsForSync: () => {
        const state = get();
        return {
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          updatedAt: new Date().toISOString(),
        };
      },
    }),
    {
      name: "ui-store-v2",
      // Don't persist sync metadata to avoid conflicts
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        _lastSyncedAt: state._lastSyncedAt,
      }),
    }
  )
);

/**
 * Selector for sync-related state
 */
export const selectUiSyncState = (state: UiStoreV2State) => ({
  theme: state.theme,
  sidebarCollapsed: state.sidebarCollapsed,
  _lastSyncedAt: state._lastSyncedAt,
  _syncVersion: state._syncVersion,
});
