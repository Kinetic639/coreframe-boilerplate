import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardHeaderV2 } from "../dashboard-header";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";

// Mock the stores
vi.mock("@/lib/stores/v2/user-store");
vi.mock("@/lib/stores/v2/app-store");

// Mock the child components
vi.mock("../header-search", () => ({
  HeaderSearch: () => <div data-testid="header-search">Search</div>,
}));

vi.mock("../header-notifications", () => ({
  HeaderNotifications: () => <div data-testid="header-notifications">Notifications</div>,
}));

vi.mock("../header-user-menu", () => ({
  HeaderUserMenu: () => <div data-testid="header-user-menu">User Menu</div>,
}));

// Mock shadcn/ui sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button aria-label="Toggle Sidebar" className={className}>
      Toggle
    </button>
  ),
  useSidebar: () => ({
    toggleSidebar: vi.fn(),
    open: true,
  }),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("DashboardHeaderV2", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    first_name: "John",
    last_name: "Doe",
    avatar_url: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default store mocks
    vi.mocked(useUserStoreV2).mockReturnValue({
      user: mockUser,
      roles: [],
      permissionSnapshot: { allow: [], deny: [] },
      isLoaded: true,
      hydrateFromServer: vi.fn(),
      setPermissionSnapshot: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(useAppStoreV2).mockReturnValue({
      activeOrgId: "org-123",
      activeBranchId: "branch-456",
      activeOrg: { id: "org-123", name: "Test Org", slug: "test-org" },
      activeBranch: {
        id: "branch-456",
        name: "Main Branch",
        organization_id: "org-123",
        slug: "main",
        created_at: "2024-01-01",
      },
      availableBranches: [],
      userModules: [],
      isLoaded: true,
      hydrateFromServer: vi.fn(),
      setActiveBranch: vi.fn(),
      clear: vi.fn(),
    });
  });

  describe("Core Structure", () => {
    it("should render header element with correct classes", () => {
      const { container } = render(<DashboardHeaderV2 />);
      const header = container.querySelector("header");

      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("flex", "h-16", "shrink-0", "items-center", "gap-2", "border-b");
    });

    it("should render with flex layout", () => {
      const { container } = render(<DashboardHeaderV2 />);
      const header = container.querySelector("header");

      expect(header).toHaveClass("flex");
    });

    it("should have border at bottom", () => {
      const { container } = render(<DashboardHeaderV2 />);
      const header = container.querySelector("header");

      expect(header).toHaveClass("border-b");
    });
  });

  describe("Layout Sections", () => {
    it("should render left section with sidebar toggle", () => {
      render(<DashboardHeaderV2 />);

      // Look for sidebar toggle button (Menu icon button)
      const toggleButton = screen.getByLabelText(/toggle sidebar/i);
      expect(toggleButton).toBeInTheDocument();
    });

    it("should render center section with search", () => {
      render(<DashboardHeaderV2 />);

      // Search renders twice (desktop + mobile), so use getAllByTestId
      const searchElements = screen.getAllByTestId("header-search");
      expect(searchElements.length).toBeGreaterThanOrEqual(1);
    });

    it("should render right section with notifications and user menu", () => {
      render(<DashboardHeaderV2 />);

      expect(screen.getByTestId("header-notifications")).toBeInTheDocument();
      expect(screen.getByTestId("header-user-menu")).toBeInTheDocument();
    });
  });

  describe("Responsive Behavior", () => {
    it("should show sidebar toggle button on mobile", () => {
      render(<DashboardHeaderV2 />);

      const toggleButton = screen.getByLabelText(/toggle sidebar/i);
      expect(toggleButton).toBeInTheDocument();
    });

    it("should render search for both desktop and mobile", () => {
      render(<DashboardHeaderV2 />);

      // Search component renders twice (desktop + mobile version)
      const searchElements = screen.getAllByTestId("header-search");
      expect(searchElements).toHaveLength(2);
    });
  });

  describe("Store Integration", () => {
    it("should render when user store is loaded", () => {
      render(<DashboardHeaderV2 />);

      expect(useUserStoreV2).toHaveBeenCalled();
      expect(screen.getByTestId("header-user-menu")).toBeInTheDocument();
    });

    it("should handle null user gracefully", () => {
      vi.mocked(useUserStoreV2).mockReturnValue({
        user: null,
        roles: [],
        permissionSnapshot: { allow: [], deny: [] },
        isLoaded: true,
        hydrateFromServer: vi.fn(),
        setPermissionSnapshot: vi.fn(),
        clear: vi.fn(),
      });

      // Should not crash when user is null
      const { container } = render(<DashboardHeaderV2 />);
      expect(container.querySelector("header")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have semantic header element", () => {
      const { container } = render(<DashboardHeaderV2 />);
      const header = container.querySelector("header");

      expect(header?.tagName).toBe("HEADER");
    });

    it("should have aria-label on sidebar toggle button", () => {
      render(<DashboardHeaderV2 />);

      const toggleButton = screen.getByLabelText(/toggle sidebar/i);
      expect(toggleButton).toHaveAttribute("aria-label");
    });
  });
});
