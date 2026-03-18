/**
 * UI Settings Sync Utilities
 *
 * Plain fetch functions for manual Save/Load UI settings.
 * Not using React Query to avoid cache-update → re-render cascades.
 *
 * Future auto-sync ready: same API shape can be used for automatic sync.
 */

import type {
  UiSettings,
  UiSettingsGetResponse,
  UiSettingsSyncResponse,
} from "@/lib/types/user-preferences";

/**
 * Input for syncing UI settings to server
 */
interface SyncUiSettingsInput {
  theme?: "light" | "dark" | "system";
  colorTheme?: string;
  sidebarCollapsed?: boolean;
  collapsedSections?: string[];
  clientUpdatedAt: string;
}

/**
 * Result from successful sync
 */
interface SyncResult {
  serverUpdatedAt: string;
  revision: number;
}

/**
 * Result from successful fetch
 */
interface FetchResult {
  ui: UiSettings | null;
  serverUpdatedAt: string | null;
  revision: number;
}

/**
 * Save UI settings to cloud (manual sync)
 *
 * @param settings - UI settings to save
 * @returns Sync result with server timestamp, or null on failure
 */
export async function saveUiSettingsToCloud(
  settings: SyncUiSettingsInput
): Promise<SyncResult | null> {
  try {
    const res = await fetch("/api/ui-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as UiSettingsSyncResponse;
      console.error("[saveUiSettingsToCloud] Failed:", errorData.error || res.statusText);
      return null;
    }

    const json = (await res.json()) as UiSettingsSyncResponse;
    if (!json.success || !json.serverUpdatedAt) {
      console.error("[saveUiSettingsToCloud] Invalid response:", json);
      return null;
    }

    return {
      serverUpdatedAt: json.serverUpdatedAt,
      revision: json.revision ?? 0,
    };
  } catch (error) {
    console.error("[saveUiSettingsToCloud] Error:", error);
    return null;
  }
}

/**
 * Load UI settings from cloud (manual load)
 *
 * @returns Fetch result with UI settings, or null on failure
 */
export async function loadUiSettingsFromCloud(): Promise<FetchResult | null> {
  try {
    const res = await fetch("/api/ui-settings", {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as UiSettingsGetResponse;
      console.error("[loadUiSettingsFromCloud] Failed:", errorData.error || res.statusText);
      return null;
    }

    const json = (await res.json()) as UiSettingsGetResponse;
    if (!json.success) {
      console.error("[loadUiSettingsFromCloud] Invalid response:", json);
      return null;
    }

    return {
      ui: json.data?.ui ?? null,
      serverUpdatedAt: json.data?.serverUpdatedAt ?? null,
      revision: json.data?.revision ?? 0,
    };
  } catch (error) {
    console.error("[loadUiSettingsFromCloud] Error:", error);
    return null;
  }
}

/**
 * Beacon sync for future auto-sync (fires on tab close)
 *
 * Uses sendBeacon for reliable delivery when tab is closing.
 * Kept for future auto-sync implementation.
 *
 * @param settings - UI settings to sync
 * @returns true if beacon was queued, false otherwise
 */
export function syncUiSettingsBeacon(settings: SyncUiSettingsInput): boolean {
  try {
    const blob = new Blob([JSON.stringify(settings)], { type: "application/json" });
    return navigator.sendBeacon("/api/ui-settings", blob);
  } catch (error) {
    console.error("[syncUiSettingsBeacon] Error:", error);
    return false;
  }
}
