import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Safe accessor for localStorage in web/SSR contexts.
 * Returns null when running in Node.js SSR (no DOM), avoiding crashes during
 * Expo static web export. The mobile tsconfig does not include DOM lib, so
 * `localStorage` must be accessed through globalThis with a type cast.
 */

const webLocalStorage = (): Storage | null => (globalThis as any).localStorage ?? null;

/**
 * Expo SecureStore adapter for Supabase Auth session persistence.
 *
 * Implements the SupportedStorage interface required by @supabase/supabase-js.
 *
 * Native (iOS/Android): tokens are encrypted at rest using iOS Keychain /
 * Android Keystore via expo-secure-store.
 *
 * Web: falls back to localStorage (used for Expo web output; not the primary
 * runtime target). SSR context has no localStorage — falls back to no-op so
 * that static export succeeds without crashing.
 *
 * Mobile-local: this adapter is specific to the Expo runtime and must
 * never be moved into a shared package.
 */
export const expoSecureStoreAdapter: SupportedStorage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => webLocalStorage()?.getItem(key) ?? null,
        setItem: (key: string, value: string) => {
          webLocalStorage()?.setItem(key, value);
        },
        removeItem: (key: string) => {
          webLocalStorage()?.removeItem(key);
        },
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };
