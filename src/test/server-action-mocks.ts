import { vi } from "vitest";

/**
 * Server Action Mocking Utilities
 *
 * Helpers for mocking Next.js 15 "use server" functions in tests
 *
 * @example
 * ```typescript
 * import { mockServerAction, mockServerActionError } from '@/test/server-action-mocks'
 *
 * // Mock a successful server action
 * mockServerAction('@/app/actions/warehouse/get-products', 'getProductsAction', {
 *   success: true,
 *   data: { products: [], total: 0 }
 * })
 *
 * // Mock a failed server action
 * mockServerActionError('@/app/actions/warehouse/get-products', 'getProductsAction', 'Failed to fetch products')
 * ```
 */

/**
 * Standard server action response type
 */
export type ServerActionResponse<T = unknown> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

/**
 * Mock a server action with a successful response
 *
 * @param modulePath - Path to the server action module (e.g., '@/app/actions/warehouse/get-products')
 * @param actionName - Name of the server action function (e.g., 'getProductsAction')
 * @param data - Data to return in the response
 */
export function mockServerAction<T>(modulePath: string, actionName: string, data: T): void {
  vi.mock(modulePath, () => ({
    [actionName]: vi.fn().mockResolvedValue({
      success: true,
      data,
    }),
  }));
}

/**
 * Mock a server action with an error response
 *
 * @param modulePath - Path to the server action module
 * @param actionName - Name of the server action function
 * @param error - Error message to return
 * @param code - Optional error code
 */
export function mockServerActionError(
  modulePath: string,
  actionName: string,
  error: string,
  code?: string
): void {
  vi.mock(modulePath, () => ({
    [actionName]: vi.fn().mockResolvedValue({
      success: false,
      error,
      code,
    }),
  }));
}

/**
 * Mock a server action that throws an exception
 *
 * @param modulePath - Path to the server action module
 * @param actionName - Name of the server action function
 * @param error - Error to throw
 */
export function mockServerActionException(
  modulePath: string,
  actionName: string,
  error: Error
): void {
  vi.mock(modulePath, () => ({
    [actionName]: vi.fn().mockRejectedValue(error),
  }));
}

/**
 * Create a spy for a server action
 *
 * @param modulePath - Path to the server action module
 * @param actionName - Name of the server action function
 * @returns A Vitest mock function that can be used for assertions
 *
 * @example
 * ```typescript
 * const getProductsSpy = spyOnServerAction('@/app/actions/warehouse/get-products', 'getProductsAction')
 *
 * // In your test
 * await userEvent.click(screen.getByRole('button', { name: /load products/i }))
 *
 * expect(getProductsSpy).toHaveBeenCalledTimes(1)
 * expect(getProductsSpy).toHaveBeenCalledWith({ organizationId: 'org-123' })
 * ```
 */
export function spyOnServerAction(modulePath: string, actionName: string) {
  const mockFn = vi.fn().mockResolvedValue({ success: true, data: null });

  vi.mock(modulePath, () => ({
    [actionName]: mockFn,
  }));

  return mockFn;
}

/**
 * Reset all server action mocks
 *
 * Call this in afterEach() to clean up between tests
 */
export function resetServerActionMocks(): void {
  vi.resetAllMocks();
}

/**
 * Mock multiple server actions from the same module
 *
 * @param modulePath - Path to the server action module
 * @param actions - Object mapping action names to their mock responses
 *
 * @example
 * ```typescript
 * mockServerActions('@/app/actions/warehouse/products', {
 *   getProductsAction: { success: true, data: { products: [], total: 0 } },
 *   createProductAction: { success: true, data: { id: 'product-1' } },
 *   deleteProductAction: { success: false, error: 'Not found' }
 * })
 * ```
 */
export function mockServerActions(
  modulePath: string,
  actions: Record<string, ServerActionResponse>
): void {
  const mocks = Object.entries(actions).reduce(
    (acc, [actionName, response]) => {
      acc[actionName] = vi.fn().mockResolvedValue(response);
      return acc;
    },
    {} as Record<string, ReturnType<typeof vi.fn>>
  );

  vi.mock(modulePath, () => mocks);
}

/**
 * Helper to create a successful server action response
 */
export function createSuccessResponse<T>(data: T): ServerActionResponse<T> {
  return { success: true, data };
}

/**
 * Helper to create a failed server action response
 */
export function createErrorResponse(error: string, code?: string): ServerActionResponse {
  return { success: false, error, code };
}

/**
 * Mock server action with delay to simulate network latency
 *
 * @param modulePath - Path to the server action module
 * @param actionName - Name of the server action function
 * @param data - Data to return
 * @param delayMs - Delay in milliseconds
 */
export function mockServerActionWithDelay<T>(
  modulePath: string,
  actionName: string,
  data: T,
  delayMs: number
): void {
  vi.mock(modulePath, () => ({
    [actionName]: vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true, data });
          }, delayMs);
        })
    ),
  }));
}

/**
 * Mock server action with custom implementation
 *
 * @param modulePath - Path to the server action module
 * @param actionName - Name of the server action function
 * @param implementation - Custom implementation function
 *
 * @example
 * ```typescript
 * mockServerActionWithImplementation(
 *   '@/app/actions/warehouse/products',
 *   'createProductAction',
 *   async (input) => {
 *     if (!input.name) {
 *       return { success: false, error: 'Name is required' }
 *     }
 *     return { success: true, data: { id: 'product-1', ...input } }
 *   }
 * )
 * ```
 */
export function mockServerActionWithImplementation<T = unknown>(
  modulePath: string,
  actionName: string,
  implementation: (...args: unknown[]) => Promise<ServerActionResponse<T>>
): void {
  vi.mock(modulePath, () => ({
    [actionName]: vi.fn().mockImplementation(implementation),
  }));
}
