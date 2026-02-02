"use client";

import { useEffect, useRef, useCallback } from "react";
import { useUiStoreV2, selectUiSyncState } from "@/lib/stores/v2/ui-store";
import {
  useDashboardSettingsQuery,
  useSyncUiSettingsMutation,
} from "@/hooks/queries/user-preferences";

/**
 * Debounce delay for syncing to database (ms)
 * Prevents API spam during rapid changes
 */
const SYNC_DEBOUNCE_MS = 500;

/**
 * UiSettingsSync Component
 *
 * Bidirectional sync between localStorage (Zustand) and database.
 *
 * Architecture:
 * - localStorage (Layer 1): Immediate, fast, no latency
 * - Database (Layer 2): Persistent, cross-device
 *
 * Sync Strategy:
 * 1. On mount: Fetch from DB, compare timestamps
 *    - If DB newer → update localStorage
 *    - If localStorage newer or DB empty → sync to DB
 * 2. On settings change: Debounced sync to DB
 *
 * @example
 * ```tsx
 * // In dashboard providers
 * <UiSettingsSync />
 * ```
 */
export function UiSettingsSync() {
  // Track sync state
  const lastSyncVersionRef = useRef<number>(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);

  // Zustand store
  const { _lastSyncedAt, _syncVersion } = useUiStoreV2(selectUiSyncState);

  const hydrateFromDb = useUiStoreV2((state) => state.hydrateFromDb);
  const setLastSyncedAt = useUiStoreV2((state) => state.setLastSyncedAt);
  const getSettingsForSync = useUiStoreV2((state) => state.getSettingsForSync);

  // React Query
  const { data: dbSettings, isFetched } = useDashboardSettingsQuery();
  const syncMutation = useSyncUiSettingsMutation();

  /**
   * Sync current localStorage state to database
   */
  const syncToDb = useCallback(() => {
    if (!isMountedRef.current) return;

    const settings = getSettingsForSync();
    syncMutation.mutate(settings, {
      onSuccess: () => {
        setLastSyncedAt(settings.updatedAt);
        lastSyncVersionRef.current = _syncVersion;
      },
    });
  }, [getSettingsForSync, syncMutation, setLastSyncedAt, _syncVersion]);

  /**
   * Initial sync on mount
   * Compare timestamps and sync in appropriate direction
   */
  useEffect(() => {
    if (!isFetched) return;

    isMountedRef.current = true;

    const dbUpdatedAt = dbSettings?.updated_at;
    const localUpdatedAt = _lastSyncedAt;

    // Case 1: DB has newer data → hydrate localStorage
    if (dbUpdatedAt && (!localUpdatedAt || dbUpdatedAt > localUpdatedAt)) {
      const uiSettings = dbSettings?.ui;
      if (uiSettings) {
        hydrateFromDb({
          theme: uiSettings.theme,
          sidebarCollapsed: uiSettings.sidebarCollapsed,
          updatedAt: dbUpdatedAt,
        });
      }
      lastSyncVersionRef.current = _syncVersion;
    }
    // Case 2: localStorage has data but DB empty or older → sync to DB
    else if (!dbUpdatedAt || (localUpdatedAt && localUpdatedAt > dbUpdatedAt)) {
      syncToDb();
    }

    return () => {
      isMountedRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isFetched]); // Only run on initial fetch

  /**
   * Watch for store changes and debounce sync
   */
  useEffect(() => {
    // Skip initial mount and unchanged state
    if (!isMountedRef.current || _syncVersion === lastSyncVersionRef.current) {
      return;
    }

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounced sync
    syncTimeoutRef.current = setTimeout(() => {
      syncToDb();
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [_syncVersion, syncToDb]);

  // No UI, just sync logic
  return null;
}
