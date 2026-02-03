import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockPathname = "/en/dashboard/account/preferences";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid={`link-${href}`}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const mockMutate = vi.fn();

vi.mock("@/lib/stores/v2/user-store", () => ({
  useUserStoreV2: vi.fn(),
}));

vi.mock("@/hooks/queries/user-preferences", () => ({
  usePreferencesQuery: vi.fn(),
  useUpdateProfileMutation: vi.fn(),
}));

vi.mock("@/components/v2/feedback/loading-skeleton", () => ({
  LoadingSkeleton: ({ variant, count }: { variant?: string; count?: number }) => (
    <div data-testid="loading-skeleton" data-variant={variant} data-count={count}>
      Loading...
    </div>
  ),
}));

vi.mock("@/components/v2/utility/copy-to-clipboard", () => ({
  CopyToClipboard: ({ text }: { text: string }) => (
    <button data-testid="copy-to-clipboard" data-text={text}>
      Copy
    </button>
  ),
}));

// ─── Import components and mocked modules after vi.mock ──────────────────────

import { AccountLayoutClient } from "../_components/account-layout-client";
import { ProfileClient } from "../profile/_components/profile-client";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { usePreferencesQuery, useUpdateProfileMutation } from "@/hooks/queries/user-preferences";

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-123",
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  avatar_url: null,
};

const mockRoles = [
  {
    role_id: "r1",
    role: "org_owner",
    org_id: "org-1",
    branch_id: null,
    scope: "org" as const,
    scope_id: "org-1",
  },
  {
    role_id: "r2",
    role: "branch_admin",
    org_id: "org-1",
    branch_id: "b-1",
    scope: "branch" as const,
    scope_id: "b-1",
  },
];

const mockPreferences = {
  id: "pref-123",
  userId: "user-123",
  displayName: "Johnny",
  phone: "+1234567890",
  timezone: "UTC",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "24h",
  locale: "en",
  organizationId: null,
  defaultBranchId: null,
  notificationSettings: {},
  dashboardSettings: {},
  moduleSettings: {},
  updatedAt: "2026-02-01T12:00:00Z",
  updatedBy: null,
};

// ─── AccountLayoutClient Tests ───────────────────────────────────────────────

describe("AccountLayoutClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/en/dashboard/account/preferences";
  });

  it("renders both tab links (preferences and profile)", () => {
    render(
      <AccountLayoutClient>
        <div>child content</div>
      </AccountLayoutClient>
    );

    const preferencesLink = screen.getByTestId("link-/dashboard/account/preferences");
    const profileLink = screen.getByTestId("link-/dashboard/account/profile");

    expect(preferencesLink).toBeInTheDocument();
    expect(profileLink).toBeInTheDocument();

    // Tabs display translation keys as text
    expect(preferencesLink).toHaveTextContent("preferences");
    expect(profileLink).toHaveTextContent("profile");
  });

  it("marks preferences tab as active when pathname ends with preferences href", () => {
    mockPathname = "/en/dashboard/account/preferences";

    render(
      <AccountLayoutClient>
        <div />
      </AccountLayoutClient>
    );

    const preferencesLink = screen.getByTestId("link-/dashboard/account/preferences");
    const profileLink = screen.getByTestId("link-/dashboard/account/profile");

    expect(preferencesLink.className).toContain("border-primary");
    expect(preferencesLink.className).toContain("text-primary");
    expect(profileLink.className).toContain("border-transparent");
  });

  it("marks profile tab as active when pathname ends with profile href", () => {
    mockPathname = "/en/dashboard/account/profile";

    render(
      <AccountLayoutClient>
        <div />
      </AccountLayoutClient>
    );

    const preferencesLink = screen.getByTestId("link-/dashboard/account/preferences");
    const profileLink = screen.getByTestId("link-/dashboard/account/profile");

    expect(profileLink.className).toContain("border-primary");
    expect(profileLink.className).toContain("text-primary");
    expect(preferencesLink.className).toContain("border-transparent");
  });

  it("handles trailing slash in pathname for active detection", () => {
    mockPathname = "/en/dashboard/account/preferences/";

    render(
      <AccountLayoutClient>
        <div />
      </AccountLayoutClient>
    );

    const preferencesLink = screen.getByTestId("link-/dashboard/account/preferences");
    expect(preferencesLink.className).toContain("border-primary");
  });

  it("renders children content", () => {
    render(
      <AccountLayoutClient>
        <div data-testid="child-content">Hello from child</div>
      </AccountLayoutClient>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Hello from child")).toBeInTheDocument();
  });
});

// ─── ProfileClient Tests ─────────────────────────────────────────────────────

describe("ProfileClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks(overrides?: {
    isLoading?: boolean;
    preferences?: typeof mockPreferences | null;
  }) {
    vi.mocked(useUserStoreV2).mockReturnValue({
      user: mockUser,
      roles: mockRoles,
      permissionSnapshot: { allow: [], deny: [] },
      isLoaded: true,
      hydrateFromServer: vi.fn(),
      setPermissionSnapshot: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(usePreferencesQuery).mockReturnValue({
      data: overrides?.preferences !== undefined ? overrides.preferences : mockPreferences,
      isLoading: overrides?.isLoading ?? false,
    } as ReturnType<typeof usePreferencesQuery>);

    vi.mocked(useUpdateProfileMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateProfileMutation>);
  }

  it("shows loading skeleton when preferences are loading", () => {
    setupMocks({ isLoading: true, preferences: null });

    render(<ProfileClient translations={{ description: "Manage your profile" }} />);

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
    // Should not render any form content while loading
    expect(screen.queryByText("title")).not.toBeInTheDocument();
  });

  it("renders profile form when loaded with user data", () => {
    setupMocks();

    render(<ProfileClient translations={{ description: "Manage your profile" }} />);

    // Card title via translation key
    expect(screen.getByText("title")).toBeInTheDocument();
    // User name is displayed
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    // Description text from translations prop
    expect(screen.getAllByText("Manage your profile").length).toBeGreaterThanOrEqual(1);
  });

  it("shows user email as read-only (disabled input)", () => {
    setupMocks();

    render(<ProfileClient translations={{ description: "Manage your profile" }} />);

    // The email label appears (translation key)
    const emailInputs = screen.getAllByDisplayValue("john@example.com");
    // One of them should be disabled (the read-only email field in the form)
    const disabledEmail = emailInputs.find((input) => input.hasAttribute("disabled"));
    expect(disabledEmail).toBeDefined();
  });

  it("shows account info section with user id and roles", () => {
    setupMocks();

    render(<ProfileClient translations={{ description: "Manage your profile" }} />);

    // Account info card title (translation key)
    expect(screen.getByText("accountInfo")).toBeInTheDocument();

    // User ID is displayed
    expect(screen.getByText("user-123")).toBeInTheDocument();

    // Roles are rendered as badges
    expect(screen.getByText("org_owner")).toBeInTheDocument();
    expect(screen.getByText("branch_admin")).toBeInTheDocument();
  });

  it("initializes display name and phone from preferences", () => {
    setupMocks();

    render(<ProfileClient translations={{ description: "Manage your profile" }} />);

    const displayNameInput = screen.getByDisplayValue("Johnny");
    const phoneInput = screen.getByDisplayValue("+1234567890");

    expect(displayNameInput).toBeInTheDocument();
    expect(phoneInput).toBeInTheDocument();
  });

  it("calls updateProfile.mutate with form values on save", () => {
    setupMocks();

    render(<ProfileClient translations={{ description: "Manage your profile" }} />);

    // Modify display name
    const displayNameInput = screen.getByDisplayValue("Johnny");
    fireEvent.change(displayNameInput, { target: { value: "New Name" } });

    // Click save
    const saveButton = screen.getByText("save");
    fireEvent.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith({
      displayName: "New Name",
      phone: "+1234567890",
    });
  });

  it("renders CopyToClipboard with user id", () => {
    setupMocks();

    render(<ProfileClient translations={{ description: "Manage your profile" }} />);

    const copyButton = screen.getByTestId("copy-to-clipboard");
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveAttribute("data-text", "user-123");
  });
});
