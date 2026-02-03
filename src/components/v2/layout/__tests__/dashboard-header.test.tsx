import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardHeaderV2 } from "../dashboard-header";

// Mock the child components
vi.mock("../header-search", () => ({
  HeaderSearch: () => <div data-testid="header-search">Search</div>,
}));

vi.mock("../header-notifications", () => ({
  HeaderNotifications: () => <div data-testid="header-notifications">Notifications</div>,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Core Structure", () => {
    it("should render header element with correct classes", () => {
      const { container } = render(<DashboardHeaderV2 />);
      const header = container.querySelector("header");

      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("flex", "h-12", "shrink-0", "items-center", "gap-2");
    });

    it("should render with flex layout", () => {
      const { container } = render(<DashboardHeaderV2 />);
      const header = container.querySelector("header");

      expect(header).toHaveClass("flex");
    });

    it("should have shadow at bottom", () => {
      const { container } = render(<DashboardHeaderV2 />);
      const header = container.querySelector("header");

      expect(header).toHaveClass("shadow-sm");
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

    it("should render right section with notifications", () => {
      render(<DashboardHeaderV2 />);

      expect(screen.getByTestId("header-notifications")).toBeInTheDocument();
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

  describe("Rendering", () => {
    it("should render header with all sections", () => {
      const { container } = render(<DashboardHeaderV2 />);

      expect(container.querySelector("header")).toBeInTheDocument();
      expect(screen.getByTestId("header-notifications")).toBeInTheDocument();
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
