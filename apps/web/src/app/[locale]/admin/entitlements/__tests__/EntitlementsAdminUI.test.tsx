import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRefresh,
  mockSuccess,
  mockError,
  mockSwitchPlan,
  mockAddModuleAddon,
  mockRemoveModuleAddon,
  mockSetLimitOverride,
  mockResetToFree,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
  mockSwitchPlan: vi.fn(),
  mockAddModuleAddon: vi.fn(),
  mockRemoveModuleAddon: vi.fn(),
  mockSetLimitOverride: vi.fn(),
  mockResetToFree: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: (...args: unknown[]) => mockSuccess(...args),
    error: (...args: unknown[]) => mockError(...args),
  },
}));

vi.mock("../actions", () => ({
  actionSwitchPlan: (...args: unknown[]) => mockSwitchPlan(...args),
  actionAddModuleAddon: (...args: unknown[]) => mockAddModuleAddon(...args),
  actionRemoveModuleAddon: (...args: unknown[]) => mockRemoveModuleAddon(...args),
  actionSetLimitOverride: (...args: unknown[]) => mockSetLimitOverride(...args),
  actionResetToFree: (...args: unknown[]) => mockResetToFree(...args),
}));

vi.mock("@/components/ui/FancySpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div>
      <select
        aria-label="entitlements-select"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        <option value="">empty</option>
        <option value="analytics">analytics</option>
        <option value="max_users">max_users</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

import { EntitlementsAdminUI } from "../EntitlementsAdminUI";

describe("EntitlementsAdminUI", () => {
  const plans = [
    { id: "free-id", name: "free", description: { en: "Starter" } },
    { id: "pro-id", name: "pro", description: { en: "Pro" } },
  ] as any;

  const entitlements = {
    plan_id: "free-id",
    enabled_modules: ["inventory", "users"],
    limits: { max_users: 5, max_branches: -1 },
  } as any;

  const addons = [{ id: "addon-1", module_slug: "reports" }] as any;
  const overrides = [{ id: "override-1", limit_key: "max_users", limit_value: 20 }] as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
  });

  it("renders dev mode disabled and missing entitlement states", () => {
    const { rerender } = render(
      <EntitlementsAdminUI
        orgId="org-1"
        entitlements={entitlements}
        plans={plans}
        addons={addons}
        overrides={overrides}
        availableModuleSlugs={["analytics"]}
        devModeEnabled={false}
      />
    );

    expect(screen.getByText("Dev Mode Disabled")).toBeInTheDocument();

    rerender(
      <EntitlementsAdminUI
        orgId="org-1"
        entitlements={null}
        plans={plans}
        addons={addons}
        overrides={overrides}
        availableModuleSlugs={["analytics"]}
        devModeEnabled
      />
    );

    expect(screen.getByText("Entitlements Missing")).toBeInTheDocument();
  });

  it("switches plans and refreshes the page", async () => {
    mockSwitchPlan.mockResolvedValue({ ok: true });

    render(
      <EntitlementsAdminUI
        orgId="org-1"
        entitlements={entitlements}
        plans={plans}
        addons={addons}
        overrides={overrides}
        availableModuleSlugs={["analytics"]}
        devModeEnabled
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to This Plan" }));

    await waitFor(() => {
      expect(mockSwitchPlan).toHaveBeenCalledWith("pro");
    });
    expect(mockSuccess).toHaveBeenCalledWith("Switched to pro plan");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("adds and removes module addons", async () => {
    mockAddModuleAddon.mockResolvedValue({ ok: true });
    mockRemoveModuleAddon.mockResolvedValue({ ok: true });

    render(
      <EntitlementsAdminUI
        orgId="org-1"
        entitlements={entitlements}
        plans={plans}
        addons={addons}
        overrides={overrides}
        availableModuleSlugs={["analytics"]}
        devModeEnabled
      />
    );

    fireEvent.change(screen.getAllByLabelText("entitlements-select")[0], {
      target: { value: "analytics" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /add/i })[0]);

    await waitFor(() => {
      expect(mockAddModuleAddon).toHaveBeenCalledWith("analytics");
    });

    fireEvent.click(screen.getAllByRole("button")[2]);

    await waitFor(() => {
      expect(mockRemoveModuleAddon).toHaveBeenCalledWith("reports");
    });
  });

  it("validates, sets overrides, and resets to free", async () => {
    mockSetLimitOverride.mockResolvedValue({ ok: true });
    mockResetToFree.mockResolvedValue({ ok: true });

    render(
      <EntitlementsAdminUI
        orgId="org-1"
        entitlements={entitlements}
        plans={plans}
        addons={addons}
        overrides={overrides}
        availableModuleSlugs={["analytics"]}
        devModeEnabled
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: /add/i })[1]);
    expect(mockError).toHaveBeenCalledWith("Please select a limit key and enter a value");

    fireEvent.change(screen.getAllByLabelText("entitlements-select")[1], {
      target: { value: "max_users" },
    });
    fireEvent.change(screen.getByPlaceholderText("Value"), { target: { value: "20" } });
    fireEvent.click(screen.getAllByRole("button", { name: /add/i })[1]);

    await waitFor(() => {
      expect(mockSetLimitOverride).toHaveBeenCalledWith("max_users", 20);
    });

    fireEvent.click(screen.getByRole("button", { name: /reset to free/i }));
    await waitFor(() => {
      expect(mockResetToFree).toHaveBeenCalled();
    });
  });
});
