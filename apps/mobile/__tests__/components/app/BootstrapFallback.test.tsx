import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

// eslint-disable-next-line import/first
import { BootstrapFallback } from "@/components/app/BootstrapFallback";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BootstrapFallback", () => {
  const onSignOut = vi.fn();
  const onRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. no-org variant: Polish heading + sign-out button ───────────────────
  it("no-org variant renders Polish heading and sign-out button", () => {
    render(<BootstrapFallback variant="no-org" onSignOut={onSignOut} />);

    expect(screen.getByText("Brak kontekstu organizacji")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wyloguj się" })).toBeTruthy();
  });

  // ── 2. forbidden variant: Polish heading + sign-out button ────────────────
  it("forbidden variant renders Polish heading and sign-out button", () => {
    render(<BootstrapFallback variant="forbidden" onSignOut={onSignOut} />);

    expect(screen.getByText("Brak dostępu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wyloguj się" })).toBeTruthy();
  });

  // ── 3. error variant: Polish heading + retry button ───────────────────────
  it("error variant renders Polish heading and retry button", () => {
    render(<BootstrapFallback variant="error" onRetry={onRetry} onSignOut={onSignOut} />);

    expect(screen.getByText("Nie udało się załadować")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).toBeTruthy();
  });

  // ── 4. error variant: custom message overrides default body ──────────────
  it("error variant displays provided message instead of default body", () => {
    render(
      <BootstrapFallback
        variant="error"
        message="Brak połączenia z siecią"
        onRetry={onRetry}
        onSignOut={onSignOut}
      />
    );

    expect(screen.getByText("Brak połączenia z siecią")).toBeTruthy();
  });

  // ── 5. sign-out button calls onSignOut ────────────────────────────────────
  it("pressing the sign-out button calls onSignOut", () => {
    render(<BootstrapFallback variant="no-org" onSignOut={onSignOut} />);

    fireEvent.click(screen.getByRole("button", { name: "Wyloguj się" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  // ── 6. retry button calls onRetry ────────────────────────────────────────
  it("pressing the retry button calls onRetry", () => {
    render(<BootstrapFallback variant="error" onRetry={onRetry} onSignOut={onSignOut} />);

    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
