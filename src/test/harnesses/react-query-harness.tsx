import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider as TanstackQueryClientProvider,
} from "@tanstack/react-query";

/**
 * React Query Test Harness
 *
 * Provides a wrapper for testing components that use React Query hooks
 *
 * @example
 * ```typescript
 * import { renderWithReactQuery } from '@/test/harnesses/react-query-harness'
 *
 * it('should fetch data with useQuery', () => {
 *   const { queryClient } = renderWithReactQuery(<MyComponent />)
 *
 *   // You can interact with the queryClient for assertions
 *   expect(queryClient.getQueryData(['key'])).toBeDefined()
 * })
 * ```
 */

export interface ReactQueryWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

/**
 * Create a fresh QueryClient for tests
 *
 * Each test should have its own QueryClient to avoid test pollution
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries in tests for faster failures
        retry: false,
        // Disable cache time for predictable tests
        gcTime: 0,
        // Disable stale time for immediate refetches
        staleTime: 0,
        // Disable refetch on window focus in tests
        refetchOnWindowFocus: false,
        // Disable refetch on mount in tests
        refetchOnMount: false,
        // Disable refetch on reconnect in tests
        refetchOnReconnect: false,
      },
      mutations: {
        // Disable retries in tests
        retry: false,
      },
    },
    logger: {
      // Suppress console logs in tests unless debugging
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

/**
 * Wrapper component that provides QueryClient to children
 */
export function ReactQueryWrapper({ children, queryClient }: ReactQueryWrapperProps) {
  const client = queryClient || createTestQueryClient();

  return <TanstackQueryClientProvider client={client}>{children}</TanstackQueryClientProvider>;
}

/**
 * Custom render function that wraps component with QueryClientProvider
 */
export interface RenderWithReactQueryOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

export interface RenderWithReactQueryResult {
  queryClient: QueryClient;
  rerender: (ui: React.ReactElement) => void;
  unmount: () => void;
}

export function renderWithReactQuery(
  ui: React.ReactElement,
  { queryClient, ...renderOptions }: RenderWithReactQueryOptions = {}
) {
  const client = queryClient || createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ReactQueryWrapper queryClient={client}>{children}</ReactQueryWrapper>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    queryClient: client,
  };
}

/**
 * Helper to wait for queries to settle
 *
 * Useful when testing components that fetch data on mount
 */
export async function waitForQueriesToSettle(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  await queryClient.invalidateQueries();
}

/**
 * Helper to clear all queries from the cache
 */
export function clearQueryCache(queryClient: QueryClient) {
  queryClient.clear();
}

/**
 * Helper to prefill query cache with mock data
 *
 * @example
 * ```typescript
 * const queryClient = createTestQueryClient()
 * prefillQueryCache(queryClient, ['products'], mockProducts)
 * renderWithReactQuery(<ProductList />, { queryClient })
 * ```
 */
export function prefillQueryCache<T>(queryClient: QueryClient, queryKey: unknown[], data: T) {
  queryClient.setQueryData(queryKey, data);
}

/**
 * Helper to simulate query error
 *
 * @example
 * ```typescript
 * const queryClient = createTestQueryClient()
 * simulateQueryError(queryClient, ['products'], new Error('Failed to fetch'))
 * renderWithReactQuery(<ProductList />, { queryClient })
 * ```
 */
export function simulateQueryError(queryClient: QueryClient, queryKey: unknown[], error: Error) {
  queryClient.setQueryData(queryKey, () => {
    throw error;
  });
}
