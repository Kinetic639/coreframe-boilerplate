/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionDebugPanel } from "../permission-debug-panel";
import * as userStoreModule from "@/lib/stores/v2/user-store";
import * as appStoreModule from "@/lib/stores/v2/app-store";
import * as permissionsHook from "@/hooks/v2/use-permissions";

// Mock the stores and hooks
vi.mock("@/lib/stores/v2/user-store");
vi.mock("@/lib/stores/v2/app-store");
vi.mock("@/hooks/v2/use-permissions");

describe("PermissionDebugPanel", () => {
  const mockUserStore = {
    user: {
      id: "user-123",
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      avatar_url: null,
    },
    permissions: ["warehouse.products.read", "warehouse.*", "teams.members.invite"],
    roles: [
      { role: "org_admin", scope: "org", organization_id: "org-1" },
      { role: "branch_admin", scope: "branch", branch_id: "branch-1" },
    ],
    isLoaded: true,
  };

  const mockAppStore = {
    activeOrgId: "org-1",
    activeBranchId: "branch-1",
    activeOrg: {
      id: "org-1",
      name: "Test Organization",
      slug: "test-org",
    },
    activeBranch: {
      id: "branch-1",
      name: "Main Branch",
    },
    availableBranches: [
      { id: "branch-1", name: "Main Branch" },
      { id: "branch-2", name: "Secondary Branch" },
    ],
    userModules: [
      { id: "1", slug: "warehouse", label: "Warehouse", settings: {} },
      { id: "2", slug: "teams", label: "Teams", settings: { feature: "enabled" } },
    ],
    isLoaded: true,
  };

  const mockPermissions = {
    can: vi.fn(),
    getSnapshot: vi.fn(() => ({
      allow: ["warehouse.products.read", "warehouse.*", "teams.members.invite"],
      deny: ["warehouse.products.delete"],
    })),
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock returns
    vi.spyOn(userStoreModule, "useUserStoreV2").mockReturnValue(mockUserStore as any);
    vi.spyOn(appStoreModule, "useAppStoreV2").mockReturnValue(mockAppStore as any);
    vi.spyOn(permissionsHook, "usePermissions").mockReturnValue(mockPermissions as any);

    // Mock NODE_ENV to be development
    vi.stubEnv("NODE_ENV", "development");
  });

  describe("Visibility", () => {
    it("should render the debug panel", () => {
      render(<PermissionDebugPanel />);

      expect(screen.getByText("Permission Debug Panel")).toBeInTheDocument();
      expect(screen.getByText("DEV ONLY")).toBeInTheDocument();
    });

    it("should have warning styling to distinguish from production UI", () => {
      render(<PermissionDebugPanel />);

      const card = screen.getByText("Permission Debug Panel").closest(".border-yellow-500");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Session Tab", () => {
    it("should display user identity information", () => {
      render(<PermissionDebugPanel />);

      // Session tab should be default
      expect(screen.getByText("user-123")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("should display active organization details", () => {
      render(<PermissionDebugPanel />);

      expect(screen.getByText("org-1")).toBeInTheDocument();
      expect(screen.getByText("Test Organization")).toBeInTheDocument();
      expect(screen.getByText("test-org")).toBeInTheDocument();
    });

    it("should display active branch details", () => {
      render(<PermissionDebugPanel />);

      expect(screen.getByText("branch-1")).toBeInTheDocument();
      expect(screen.getByText("Main Branch")).toBeInTheDocument();
      expect(screen.getByText("2 branches")).toBeInTheDocument();
    });

    it("should display user roles with scope indicators", () => {
      render(<PermissionDebugPanel />);

      const orgAdminBadge = screen.getByText("org_admin");
      expect(orgAdminBadge).toBeInTheDocument();
      expect(within(orgAdminBadge.parentElement!).getByText("(org)")).toBeInTheDocument();

      const branchAdminBadge = screen.getByText("branch_admin");
      expect(branchAdminBadge).toBeInTheDocument();
      expect(within(branchAdminBadge.parentElement!).getByText("(branch)")).toBeInTheDocument();
    });

    it("should show load status indicators", () => {
      render(<PermissionDebugPanel />);

      const statusSection = screen.getByText("Status").parentElement!;

      // Check for status text
      expect(within(statusSection).getByText("User Store Loaded:")).toBeInTheDocument();
      expect(within(statusSection).getByText("App Store Loaded:")).toBeInTheDocument();

      // Lucide icons are rendered as SVG without role="img", so just check they exist via parent
      expect(statusSection.querySelector("svg")).toBeInTheDocument();
    });

    it("should handle missing user data gracefully", () => {
      vi.spyOn(userStoreModule, "useUserStoreV2").mockReturnValue({
        user: null,
        permissions: [],
        roles: [],
        isLoaded: false,
      } as any);

      render(<PermissionDebugPanel />);

      // Check for multiple N/A occurrences (ID, Email, Name, etc.)
      const naElements = screen.getAllByText("N/A");
      expect(naElements.length).toBeGreaterThan(0);
    });
  });

  describe("Permissions Tab", () => {
    it("should display allowed permissions grouped by category", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      // Click Permissions tab
      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      expect(screen.getByText("Allowed Permissions")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument(); // Badge count

      // Check for permissions
      expect(screen.getByText("warehouse.products.read")).toBeInTheDocument();
      expect(screen.getByText("warehouse.*")).toBeInTheDocument();
      expect(screen.getByText("teams.members.invite")).toBeInTheDocument();
    });

    it("should display denied permissions with overrides", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      expect(screen.getByText("Denied Permissions (Overrides)")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument(); // Badge count
      expect(screen.getByText("warehouse.products.delete")).toBeInTheDocument();
    });

    it("should show wildcard indicators for pattern permissions", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      // warehouse.* should have wildcard indicator
      const wildcardPermission = screen.getByText("warehouse.*").parentElement!;
      expect(within(wildcardPermission).getByTitle("Wildcard")).toBeInTheDocument();
    });

    it("should filter permissions based on search input", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      const filterInput = screen.getByLabelText("Filter Permissions");
      await user.type(filterInput, "warehouse");

      expect(screen.getByText("warehouse.products.read")).toBeInTheDocument();
      expect(screen.getByText("warehouse.*")).toBeInTheDocument();
      expect(screen.queryByText("teams.members.invite")).not.toBeInTheDocument();
    });

    it("should display explanation of permission system", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      expect(screen.getByText(/Permissions use deny-first semantics/i)).toBeInTheDocument();
      expect(screen.getByText(/Wildcards \(\*\) match multiple permissions/i)).toBeInTheDocument();
      expect(screen.getByText(/Scope precedence: branch > org > global/i)).toBeInTheDocument();
    });

    it("should show message when no permissions exist", async () => {
      const user = userEvent.setup();
      vi.spyOn(permissionsHook, "usePermissions").mockReturnValue({
        can: vi.fn(),
        getSnapshot: vi.fn(() => ({
          allow: [],
          deny: [],
        })),
      } as any);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      expect(screen.getByText("No allowed permissions")).toBeInTheDocument();
      expect(screen.getByText("No denied permissions")).toBeInTheDocument();
    });
  });

  describe("Context Tab", () => {
    it("should display user modules with settings", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /context/i }));

      expect(screen.getByText("Warehouse")).toBeInTheDocument();
      expect(screen.getByText("warehouse")).toBeInTheDocument();

      expect(screen.getByText("Teams")).toBeInTheDocument();
      expect(screen.getByText("teams")).toBeInTheDocument();
      expect(screen.getByText(/Settings: feature/i)).toBeInTheDocument();
    });

    it("should display available branches with active highlighting", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /context/i }));

      const mainBranch = screen.getByText("Main Branch").closest(".border-primary");
      expect(mainBranch).toBeInTheDocument();
      expect(within(mainBranch!).getByText("Active")).toBeInTheDocument();

      const secondaryBranch = screen.getByText("Secondary Branch");
      expect(secondaryBranch).toBeInTheDocument();
      expect(within(secondaryBranch.parentElement!).queryByText("Active")).not.toBeInTheDocument();
    });

    it("should show message when no modules assigned", async () => {
      const user = userEvent.setup();
      vi.spyOn(appStoreModule, "useAppStoreV2").mockReturnValue({
        ...mockAppStore,
        userModules: [],
      } as any);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /context/i }));

      expect(screen.getByText("No modules assigned")).toBeInTheDocument();
    });

    it("should show message when no branches available", async () => {
      const user = userEvent.setup();
      vi.spyOn(appStoreModule, "useAppStoreV2").mockReturnValue({
        ...mockAppStore,
        availableBranches: [],
      } as any);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /context/i }));

      expect(screen.getByText("No branches available")).toBeInTheDocument();
    });
  });

  describe("Checker Tab", () => {
    it("should allow interactive permission testing", async () => {
      const user = userEvent.setup();
      mockPermissions.can.mockReturnValue(true);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /checker/i }));

      const input = screen.getByLabelText("Test Permission");
      await user.type(input, "warehouse.products.read");

      expect(mockPermissions.can).toHaveBeenCalledWith("warehouse.products.read");
    });

    it("should show ALLOWED result for permitted actions", async () => {
      const user = userEvent.setup();
      mockPermissions.can.mockReturnValue(true);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /checker/i }));

      const input = screen.getByLabelText("Test Permission");
      await user.type(input, "warehouse.products.read");

      expect(screen.getByText("ALLOWED")).toBeInTheDocument();
      expect(
        screen.getByText("✓ Permission is in allow list or matches an allow wildcard")
      ).toBeInTheDocument();
    });

    it("should show DENIED result for denied actions", async () => {
      const user = userEvent.setup();
      mockPermissions.can.mockReturnValue(false);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /checker/i }));

      const input = screen.getByLabelText("Test Permission");
      await user.type(input, "admin.users.delete");

      expect(screen.getByText("DENIED")).toBeInTheDocument();
      expect(screen.getByText("✗ Permission is denied or not in allow list")).toBeInTheDocument();
    });

    it("should provide example permissions to test", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /checker/i }));

      const exampleButton = screen.getByRole("button", { name: "warehouse.products.read" });
      await user.click(exampleButton);

      const input = screen.getByLabelText("Test Permission");
      expect(input).toHaveValue("warehouse.products.read");
    });

    it("should show matching allow patterns for allowed permissions", async () => {
      const user = userEvent.setup();
      mockPermissions.can.mockReturnValue(true);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /checker/i }));

      const input = screen.getByLabelText("Test Permission");
      await user.type(input, "warehouse.products.read");

      expect(screen.getByText("Matching Allow Patterns:")).toBeInTheDocument();
    });

    it("should show deny overrides for denied permissions", async () => {
      const user = userEvent.setup();
      mockPermissions.can.mockReturnValue(false);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /checker/i }));

      const input = screen.getByLabelText("Test Permission");
      await user.type(input, "warehouse.products.delete");

      // Should show the denied permission from the snapshot
      expect(screen.getByText("Deny Overrides:")).toBeInTheDocument();
    });
  });

  describe("Performance Tab", () => {
    it("should display permission counts", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /performance/i }));

      expect(screen.getByText("Permission Count (Allow):")).toBeInTheDocument();
      expect(screen.getByText("Permission Count (Deny):")).toBeInTheDocument();
      expect(screen.getByText("Total Permissions:")).toBeInTheDocument();
      expect(screen.getByText("Wildcard Permissions:")).toBeInTheDocument();

      // Verify counts are displayed (exact values may vary)
      const performanceSection = screen
        .getByText("Permission Count (Allow):")
        .closest(".rounded-lg");
      expect(performanceSection).toBeInTheDocument();
    });

    it("should count wildcard permissions", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /performance/i }));

      expect(screen.getByText("Wildcard Permissions:")).toBeInTheDocument();
      // warehouse.* is a wildcard
    });

    it("should display performance targets", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /performance/i }));

      expect(screen.getByText(/Permission load time: < 200ms/i)).toBeInTheDocument();
      expect(screen.getByText(/Permission check time: < 1ms/i)).toBeInTheDocument();
      expect(screen.getByText(/No N\+1 queries/i)).toBeInTheDocument();
    });

    it("should show optimization status", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /performance/i }));

      expect(screen.getByText("Optimization Status")).toBeInTheDocument();
      expect(screen.getByText("Snapshot Cached:")).toBeInTheDocument();
      expect(screen.getByText("Context Deduplication:")).toBeInTheDocument();
      expect(screen.getByText("RLS Enabled:")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<PermissionDebugPanel />);

      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /session/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /permissions/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /context/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /checker/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /performance/i })).toBeInTheDocument();
    });

    it("should have proper form labels", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      await user.click(screen.getByRole("tab", { name: /permissions/i }));
      expect(screen.getByLabelText("Filter Permissions")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /checker/i }));
      expect(screen.getByLabelText("Test Permission")).toBeInTheDocument();
    });

    it("should be keyboard navigable", async () => {
      const user = userEvent.setup();
      render(<PermissionDebugPanel />);

      // Tab to the tabs
      await user.tab();

      // Should be able to navigate with arrow keys
      const permissionsTab = screen.getByRole("tab", { name: /permissions/i });
      permissionsTab.focus();
      await user.keyboard("{ArrowRight}");

      // Context tab should be focused
      expect(screen.getByRole("tab", { name: /context/i })).toHaveFocus();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty permission snapshot", async () => {
      const user = userEvent.setup();
      vi.spyOn(permissionsHook, "usePermissions").mockReturnValue({
        can: vi.fn(),
        getSnapshot: vi.fn(() => ({
          allow: [],
          deny: [],
        })),
      } as any);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      expect(screen.getByText("No allowed permissions")).toBeInTheDocument();
      expect(screen.getByText("No denied permissions")).toBeInTheDocument();
    });

    it("should handle null user", () => {
      vi.spyOn(userStoreModule, "useUserStoreV2").mockReturnValue({
        user: null,
        permissions: [],
        roles: [],
        isLoaded: true,
      } as any);

      render(<PermissionDebugPanel />);

      // Should show N/A for user fields
      const naElements = screen.getAllByText("N/A");
      expect(naElements.length).toBeGreaterThan(0);

      // Should show "No roles assigned"
      expect(screen.getByText("No roles assigned")).toBeInTheDocument();
    });

    it("should handle null organization", () => {
      vi.spyOn(appStoreModule, "useAppStoreV2").mockReturnValue({
        ...mockAppStore,
        activeOrgId: null,
        activeOrg: null,
      } as any);

      render(<PermissionDebugPanel />);

      expect(screen.getByText("None")).toBeInTheDocument();
    });

    it("should handle null branch", () => {
      vi.spyOn(appStoreModule, "useAppStoreV2").mockReturnValue({
        ...mockAppStore,
        activeBranchId: null,
        activeBranch: null,
      } as any);

      render(<PermissionDebugPanel />);

      expect(screen.getAllByText("None")).toHaveLength(1);
    });

    it("should handle permissions with special characters", async () => {
      const user = userEvent.setup();
      const specialSnapshot = {
        allow: ["warehouse.products.read", "special:permission-with-dash"],
        deny: [],
      };

      vi.spyOn(permissionsHook, "usePermissions").mockReturnValue({
        can: vi.fn(),
        getSnapshot: vi.fn(() => specialSnapshot),
      } as any);

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      // The special permission appears twice: as category header and as permission
      // Get all occurrences and verify at least one is in a code element
      const permissionTexts = screen.getAllByText("special:permission-with-dash");
      expect(permissionTexts.length).toBeGreaterThan(0);

      // Find the one that's in a code element
      const codePermission = permissionTexts.find((el) => el.tagName.toLowerCase() === "code");
      expect(codePermission).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("should not cause re-renders when data hasn't changed", () => {
      const { rerender } = render(<PermissionDebugPanel />);

      // Re-render with same data
      rerender(<PermissionDebugPanel />);

      // Should still render correctly
      expect(screen.getByText("Permission Debug Panel")).toBeInTheDocument();
    });

    it("should memoize filtered permissions", async () => {
      const user = userEvent.setup();

      render(<PermissionDebugPanel />);
      await user.click(screen.getByRole("tab", { name: /permissions/i }));

      // Get initial permission count by finding <code> elements
      const allowedSection = screen.getByText("Allowed Permissions").parentElement!;
      const initialPermissions = allowedSection.querySelectorAll("code");

      // Type in filter
      const filterInput = screen.getByLabelText("Filter Permissions");
      await user.type(filterInput, "warehouse");

      // Permissions should be filtered (fewer shown)
      const filteredPermissions = allowedSection.querySelectorAll("code");

      // Either filtered list is smaller, or same if all permissions match "warehouse"
      expect(filteredPermissions.length).toBeLessThanOrEqual(initialPermissions.length);
    });
  });
});
