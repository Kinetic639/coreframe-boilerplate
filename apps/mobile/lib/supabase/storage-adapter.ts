import * as SecureStore from "expo-secure-store";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Expo SecureStore adapter for Supabase Auth session persistence.
 *
 * Implements the SupportedStorage interface required by @supabase/supabase-js.
 * Tokens are encrypted at rest using iOS Keychain / Android Keystore.
 *
 * Mobile-local: this adapter is specific to the Expo runtime and must
 * never be moved into a shared package.
 */
export const expoSecureStoreAdapter: SupportedStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
