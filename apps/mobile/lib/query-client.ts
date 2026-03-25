import { QueryClient } from "@tanstack/react-query";

/**
 * Factory for creating a mobile QueryClient instance.
 *
 * Called once per authenticated session in (app)/_layout.tsx via useMemo.
 * The instance is NOT a module-level singleton: placing QueryClientProvider
 * inside the authenticated app tree means the cache is automatically destroyed
 * when the user signs out (React unmounts the (app) tree). This prevents
 * org-scoped or user-scoped data from leaking across sessions without requiring
 * explicit cache-clearing code in the sign-out path.
 *
 * Default options chosen for mobile conditions:
 * - staleTime 5 min: org-level data (profiles, entitlements) changes rarely
 * - retry 2: transient network failures are common on mobile
 * - refetchOnWindowFocus false: no browser window focus concept in React Native
 * - refetchOnReconnect true: meaningful on mobile (Wi-Fi ↔ cellular switch)
 */
export function createMobileQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}
