import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { useAppStore } from "@/lib/stores/app-store";
import type { AppContext } from "@/lib/stores/app-store";

/**
 * AppContext Test Harness
 *
 * Provides a wrapper for testing components that use useAppContext()
 *
 * @example
 * ```typescript
 * import { renderWithAppContext } from '@/test/harnesses/app-context-harness'
 *
 * it('should render with app context', () => {
 *   renderWithAppContext(<MyComponent />, {
 *     appContext: {
 *       activeOrgId: 'org-123',
 *       activeBranchId: 'branch-456',
 *       activeOrg: mockOrg,
 *       activeBranch: mockBranch
 *     }
 *   })
 * })
 * ```
 */

export interface AppContextWrapperProps {
  children: React.ReactNode;
  appContext?: Partial<AppContext>;
}

/**
 * Default mock app context for tests
 */
export const createMockAppContext = (overrides?: Partial<AppContext>): AppContext => ({
  activeOrg: {
    organization_id: "mock-org-id",
    name: "Mock Organization",
    slug: "mock-org",
    bio: null,
    logo_url: null,
    created_at: new Date().toISOString(),
    website: null,
    theme_color: null,
    font_color: null,
    name_2: null,
  },
  activeBranch: {
    id: "mock-branch-id",
    branch_id: "mock-branch-id",
    organization_id: "mock-org-id",
    name: "Mock Branch",
    slug: "mock-branch",
    created_at: new Date().toISOString(),
    deleted_at: null,
    bio: null,
    logo_url: null,
    website: null,
  },
  activeOrgId: "mock-org-id",
  activeBranchId: "mock-branch-id",
  availableBranches: [
    {
      id: "mock-branch-id",
      branch_id: "mock-branch-id",
      organization_id: "mock-org-id",
      name: "Mock Branch",
      slug: "mock-branch",
      created_at: new Date().toISOString(),
      deleted_at: null,
      bio: null,
      logo_url: null,
      website: null,
    },
  ],
  userModules: [
    {
      id: "mock-module-1",
      slug: "warehouse",
      label: "Warehouse",
      settings: {},
    },
  ],
  location: null,
  locations: [],
  suppliers: [],
  organizationUsers: [],
  privateContacts: [],
  subscription: null,
  ...overrides,
});

/**
 * Wrapper component that initializes AppContext for tests
 */
export function AppContextWrapper({ children, appContext = {} }: AppContextWrapperProps) {
  React.useEffect(() => {
    const mockContext = createMockAppContext(appContext);
    useAppStore.getState().setContext(mockContext);

    // Cleanup on unmount
    return () => {
      useAppStore.getState().clear();
    };
  }, [appContext]);

  return <>{children}</>;
}

/**
 * Custom render function that wraps component with AppContext
 */
export interface RenderWithAppContextOptions extends Omit<RenderOptions, "wrapper"> {
  appContext?: Partial<AppContext>;
}

export function renderWithAppContext(
  ui: React.ReactElement,
  { appContext, ...renderOptions }: RenderWithAppContextOptions = {}
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppContextWrapper appContext={appContext}>{children}</AppContextWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Helper to update app context during tests
 */
export function updateAppContext(updates: Partial<AppContext>) {
  const currentContext = useAppStore.getState();
  useAppStore.getState().setContext({
    activeOrg: currentContext.activeOrg,
    activeBranch: currentContext.activeBranch,
    activeOrgId: currentContext.activeOrgId,
    activeBranchId: currentContext.activeBranchId,
    availableBranches: currentContext.availableBranches,
    userModules: currentContext.userModules,
    location: currentContext.location,
    locations: currentContext.locations,
    suppliers: currentContext.suppliers,
    organizationUsers: currentContext.organizationUsers,
    privateContacts: currentContext.privateContacts,
    subscription: currentContext.subscription,
    ...updates,
  });
}

/**
 * Helper to clear app context
 */
export function clearAppContext() {
  useAppStore.getState().clear();
}
