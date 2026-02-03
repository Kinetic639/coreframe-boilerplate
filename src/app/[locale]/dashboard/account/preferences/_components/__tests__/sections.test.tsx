import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserPreferences } from "@/lib/types/user-preferences";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();
const mockRouterReplace = vi.fn();
const mockSetTheme = vi.fn();
const mockSetStoreTheme = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "pl"] },
}));

vi.mock("@/hooks/queries/user-preferences", () => ({
  useUpdateRegionalSettingsMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useUpdateNotificationSettingsMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: mockSetTheme }),
}));

vi.mock("@/lib/stores/v2/ui-store", () => ({
  useUiStoreV2: () => mockSetStoreTheme,
}));

// Mock shadcn Select – radix portals and popovers are problematic in jsdom.
// We replace them with plain HTML equivalents that allow value assertions and
// change events to flow through.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <div data-testid="select" data-value={value}>
      {typeof children === "function" ? null : children}
      {/* Plain input so fireEvent.change({ target: { value } }) works in jsdom */}
      <input
        data-testid="select-native"
        defaultValue={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      />
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock RadioGroup with data-testid so we can assert on values
vi.mock("@/components/ui/radio-group", () => ({
  RadioGroup: ({
    children,
    value,
    onValueChange,
    className,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    className?: string;
  }) => (
    <div data-testid="radio-group" data-value={value} className={className}>
      {children}
      <input
        data-testid="radio-group-input"
        type="hidden"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      />
    </div>
  ),
  RadioGroupItem: ({ value, id }: { value: string; id?: string }) => (
    <input type="radio" value={value} id={id} data-testid={`radio-${value}`} readOnly />
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className} data-testid="card-title">
      {children}
    </h3>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
    disabled,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      role="switch"
      id={id}
      data-testid={id ?? "switch"}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    type,
    value,
    onChange,
    className,
  }: {
    id?: string;
    type?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
  }) => <input id={id} type={type} value={value} onChange={onChange} className={className} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

// Stub lucide-react icons
vi.mock("lucide-react", () => ({
  Sun: () => <span data-testid="icon-sun" />,
  Moon: () => <span data-testid="icon-moon" />,
  Laptop: () => <span data-testid="icon-laptop" />,
  Check: () => <span data-testid="icon-check" />,
  Palette: () => <span data-testid="icon-palette" />,
  Globe: () => <span data-testid="icon-globe" />,
  Clock: () => <span data-testid="icon-clock" />,
  Bell: () => <span data-testid="icon-bell" />,
}));

// Mock color themes constant
vi.mock("@/lib/constants/color-themes", () => ({
  COLOR_THEME_STORAGE_KEY: "color-theme",
  COLOR_THEME_CHANGE_EVENT: "color-theme-change",
  COLOR_THEMES: [
    { name: "default", label: "Default", colors: ["#e87952", "#5b9ad5", "#4472c4", "#ed7d31"] },
    { name: "graphite", label: "Graphite", colors: ["#606060", "#909090", "#565656", "#a8a8a8"] },
  ],
}));

// ---------------------------------------------------------------------------
// Imports under test (must come after vi.mock calls)
// ---------------------------------------------------------------------------

import { AppearanceSection } from "../appearance-section";
import { RegionalSection } from "../regional-section";
import { NotificationsSection } from "../notifications-section";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockPreferences: UserPreferences = {
  id: "pref-123",
  userId: "user-123",
  displayName: "Test User",
  phone: null,
  timezone: "Europe/Warsaw",
  dateFormat: "DD.MM.YYYY",
  timeFormat: "24h",
  locale: "pl",
  organizationId: null,
  defaultBranchId: null,
  notificationSettings: {
    email: { enabled: true },
    inApp: { enabled: false },
    quietHours: { enabled: false, start: "22:00", end: "07:00", timezone: "UTC" },
  },
  dashboardSettings: {},
  moduleSettings: {},
  updatedAt: "2026-02-01T12:00:00Z",
  updatedBy: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppearanceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Provide a minimal localStorage stub
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, val) => {
      store[key] = val;
    });
  });

  it("renders the theme card title", () => {
    render(<AppearanceSection />);
    const titles = screen.getAllByTestId("card-title");
    const themeTitle = titles.find((el) => el.textContent?.includes("theme"));
    expect(themeTitle).toBeDefined();
  });

  it("renders light, dark, and system radio options", () => {
    render(<AppearanceSection />);
    expect(screen.getByTestId("radio-light")).toBeInTheDocument();
    expect(screen.getByTestId("radio-dark")).toBeInTheDocument();
    expect(screen.getByTestId("radio-system")).toBeInTheDocument();
  });

  it("renders the color theme grid with mocked themes", () => {
    render(<AppearanceSection />);
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Graphite")).toBeInTheDocument();
  });

  it("renders color theme card title", () => {
    render(<AppearanceSection />);
    const titles = screen.getAllByTestId("card-title");
    const colorTitle = titles.find((el) => el.textContent?.includes("colorTheme"));
    expect(colorTitle).toBeDefined();
  });

  it("clicking a color theme button stores value in localStorage", () => {
    render(<AppearanceSection />);
    const graphiteBtn = screen.getByText("Graphite").closest("button");
    expect(graphiteBtn).toBeTruthy();
    fireEvent.click(graphiteBtn!);
    expect(localStorage.setItem).toHaveBeenCalledWith("color-theme", "graphite");
  });

  it("reads saved color theme from localStorage on mount", () => {
    (Storage.prototype.getItem as ReturnType<typeof vi.fn>).mockReturnValue("graphite");
    render(<AppearanceSection />);
    expect(localStorage.getItem).toHaveBeenCalledWith("color-theme");
  });
});

// ---------------------------------------------------------------------------

describe("RegionalSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default values when preferences is null", () => {
    render(<RegionalSection preferences={null} />);
    // The language card should be present
    expect(screen.getByText("language")).toBeInTheDocument();
    // Regional card title should be present
    expect(screen.getByText("regional")).toBeInTheDocument();
  });

  it("renders language and regional card titles", () => {
    render(<RegionalSection preferences={mockPreferences} />);
    expect(screen.getByText("language")).toBeInTheDocument();
    expect(screen.getByText("regional")).toBeInTheDocument();
  });

  it("renders timezone, date format, and time format labels", () => {
    render(<RegionalSection preferences={mockPreferences} />);
    expect(screen.getByText("timezone")).toBeInTheDocument();
    expect(screen.getByText("dateFormat")).toBeInTheDocument();
    expect(screen.getByText("timeFormat")).toBeInTheDocument();
  });

  it("renders 24h and 12h time format radio options", () => {
    render(<RegionalSection preferences={mockPreferences} />);
    expect(screen.getByTestId("radio-24h")).toBeInTheDocument();
    expect(screen.getByTestId("radio-12h")).toBeInTheDocument();
  });

  it("fires mutate and router.replace when locale changes", () => {
    render(<RegionalSection preferences={mockPreferences} />);
    // Find the first native select (language selector) and trigger a change
    const selects = screen.getAllByTestId("select-native");
    // The language select is the first one rendered
    fireEvent.change(selects[0], { target: { value: "pl" } });
    expect(mockMutate).toHaveBeenCalledWith({ locale: "pl" });
    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard/account/preferences", {
      locale: "pl",
    });
  });

  it("fires mutate when timezone changes", () => {
    render(<RegionalSection preferences={mockPreferences} />);
    const selects = screen.getAllByTestId("select-native");
    // Timezone select is the second one
    fireEvent.change(selects[1], { target: { value: "Europe/London" } });
    expect(mockMutate).toHaveBeenCalledWith({ timezone: "Europe/London" });
  });

  it("renders date format preview text", () => {
    render(<RegionalSection preferences={mockPreferences} />);
    // "preview" appears as part of "preview: <formatted-date>" inside a <p>
    const previews = screen.getAllByText(/preview/);
    expect(previews.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------

describe("NotificationsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the notifications card title", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    expect(screen.getByText("notifications")).toBeInTheDocument();
  });

  it("renders email and in-app notification toggle labels", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    expect(screen.getByText("emailNotifications")).toBeInTheDocument();
    expect(screen.getByText("inAppNotifications")).toBeInTheDocument();
  });

  it("renders push notifications with coming soon badge", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    expect(screen.getByText("pushNotifications")).toBeInTheDocument();
    expect(screen.getByText("comingSoon")).toBeInTheDocument();
  });

  it("renders quiet hours toggle", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    expect(screen.getByText("quietHours")).toBeInTheDocument();
  });

  it("email toggle reflects preferences (enabled=true)", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    const emailSwitch = screen.getByTestId("email-notif");
    expect(emailSwitch).toHaveAttribute("aria-checked", "true");
  });

  it("in-app toggle reflects preferences (enabled=false)", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    const inAppSwitch = screen.getByTestId("inapp-notif");
    expect(inAppSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("toggling email fires mutation", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    const emailSwitch = screen.getByTestId("email-notif");
    fireEvent.click(emailSwitch);
    expect(mockMutate).toHaveBeenCalledWith({ email: { enabled: false } });
  });

  it("toggling in-app fires mutation", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    const inAppSwitch = screen.getByTestId("inapp-notif");
    fireEvent.click(inAppSwitch);
    expect(mockMutate).toHaveBeenCalledWith({ inApp: { enabled: true } });
  });

  it("quiet hours time inputs appear when quiet hours is enabled", () => {
    const prefsWithQuietHours: UserPreferences = {
      ...mockPreferences,
      notificationSettings: {
        ...mockPreferences.notificationSettings,
        quietHours: { enabled: true, start: "22:00", end: "07:00", timezone: "UTC" },
      },
    };
    render(<NotificationsSection preferences={prefsWithQuietHours} />);
    expect(screen.getByLabelText("startTime")).toBeInTheDocument();
    expect(screen.getByLabelText("endTime")).toBeInTheDocument();
  });

  it("quiet hours time inputs are hidden when quiet hours is disabled", () => {
    render(<NotificationsSection preferences={mockPreferences} />);
    expect(screen.queryByLabelText("startTime")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("endTime")).not.toBeInTheDocument();
  });

  it("renders with defaults when preferences is null", () => {
    render(<NotificationsSection preferences={null} />);
    // Should still render the card without crashing
    expect(screen.getByText("notifications")).toBeInTheDocument();
    // Email defaults to enabled
    const emailSwitch = screen.getByTestId("email-notif");
    expect(emailSwitch).toHaveAttribute("aria-checked", "true");
  });
});
