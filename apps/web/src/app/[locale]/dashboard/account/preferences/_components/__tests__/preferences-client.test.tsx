import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePreferencesQuery = vi.fn();

vi.mock("@/hooks/queries/user-preferences", () => ({
  usePreferencesQuery: () => mockUsePreferencesQuery(),
}));

vi.mock("@/components/v2/feedback/loading-skeleton", () => ({
  LoadingSkeleton: ({ variant, count }: { variant: string; count: number }) => (
    <div data-testid="loading-skeleton">{`${variant}:${count}`}</div>
  ),
}));

vi.mock("../appearance-section", () => ({
  AppearanceSection: () => <div>appearance section</div>,
}));

vi.mock("../regional-section", () => ({
  RegionalSection: ({ preferences }: { preferences: unknown }) => (
    <div data-testid="regional-section">{JSON.stringify(preferences)}</div>
  ),
}));

import { PreferencesClient } from "../preferences-client";

describe("PreferencesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the loading skeleton while preferences are loading", () => {
    mockUsePreferencesQuery.mockReturnValue({ data: null, isLoading: true });

    render(<PreferencesClient translations={{ description: "Manage preferences" }} />);

    expect(screen.getByTestId("loading-skeleton")).toHaveTextContent("form:2");
  });

  it("renders appearance and regional sections once preferences load", () => {
    mockUsePreferencesQuery.mockReturnValue({
      data: { locale: "en", timezone: "UTC" },
      isLoading: false,
    });

    render(<PreferencesClient translations={{ description: "Manage preferences" }} />);

    expect(screen.getByText("Manage preferences")).toBeInTheDocument();
    expect(screen.getByText("appearance section")).toBeInTheDocument();
    expect(screen.getByTestId("regional-section")).toHaveTextContent('"locale":"en"');
  });

  it("passes null preferences through when the query returns no data", () => {
    mockUsePreferencesQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<PreferencesClient translations={{ description: "Manage preferences" }} />);

    expect(screen.getByTestId("regional-section")).toHaveTextContent("null");
  });
});
