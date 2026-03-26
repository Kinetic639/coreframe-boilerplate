import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

// ─── Import screen after mocks ────────────────────────────────────────────────

// eslint-disable-next-line import/first
import MoreScreen from "@/app/(app)/(tabs)/more";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MoreScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Header title ───────────────────────────────────────────────────────
  it("renders Więcej header title", () => {
    render(<MoreScreen />);
    expect(screen.getByText("Więcej")).toBeTruthy();
  });

  // ── 2. Diagnostics row label ──────────────────────────────────────────────
  it("renders Diagnostyka row label", () => {
    render(<MoreScreen />);
    expect(screen.getByText("Diagnostyka")).toBeTruthy();
  });

  // ── 3. Row press navigates to diagnostics ─────────────────────────────────
  it("calls router.push with /(app)/diagnostics when Diagnostyka row is pressed", () => {
    render(<MoreScreen />);
    const row = screen.getByRole("button", { name: "Open Diagnostics" });
    fireEvent.click(row);
    expect(mockRouterPush).toHaveBeenCalledWith("/(app)/diagnostics");
  });

  // ── 4. Sign-out button visible ────────────────────────────────────────────
  it("renders Wyloguj się sign-out button", () => {
    render(<MoreScreen />);
    expect(screen.getByText("Wyloguj się")).toBeTruthy();
  });

  // ── 5. Sign-out button calls signOut ──────────────────────────────────────
  it("calls signOut when Wyloguj się is pressed", () => {
    render(<MoreScreen />);
    const btn = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(btn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
