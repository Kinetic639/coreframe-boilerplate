/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReplace, mockSearchParams } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSearchParams: { get: vi.fn(() => ""), toString: vi.fn(() => "") },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard/workshop",
  useSearchParams: () => mockSearchParams,
}));

import { RepairOrdersSearch } from "../repair-orders-search";

describe("RepairOrdersSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.get.mockReturnValue("");
    mockSearchParams.toString.mockReturnValue("");
  });

  it("renders with the initial query pre-filled", () => {
    render(<RepairOrdersSearch initialQuery="ZL/900" />);
    expect(screen.getByTestId("repair-orders-search-input")).toHaveValue("ZL/900");
  });

  it("navigates to ?q=<value> after the debounce delay once the user types", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<RepairOrdersSearch initialQuery="" />);

    const input = screen.getByTestId("repair-orders-search-input");
    fireEvent.change(input, { target: { value: "TESTVIN0000000001" } });

    vi.advanceTimersByTime(400);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());

    expect(mockReplace).toHaveBeenCalledWith("/dashboard/workshop?q=TESTVIN0000000001");
    vi.useRealTimers();
  });

  it("removes the q param entirely when cleared (never navigates to ?q=)", async () => {
    mockSearchParams.get.mockReturnValue("ZL/900");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<RepairOrdersSearch initialQuery="ZL/900" />);

    fireEvent.click(screen.getByLabelText("search.clear"));

    vi.advanceTimersByTime(400);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());

    expect(mockReplace).toHaveBeenCalledWith("/dashboard/workshop");
    vi.useRealTimers();
  });
});
