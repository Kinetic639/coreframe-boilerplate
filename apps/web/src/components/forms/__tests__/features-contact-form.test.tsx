import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSuccess, mockError } = vi.hoisted(() => ({
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mockSuccess,
    error: mockError,
  },
}));

import FeaturesContactForm from "../FeaturesContactForm";

describe("FeaturesContactForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an error when suggestion is empty", () => {
    render(<FeaturesContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /wyślij/i }));

    expect(mockError).toHaveBeenCalledWith("Proszę opisać swoją sugestię");
  });

  it("submits and resets the form", async () => {
    render(<FeaturesContactForm />);

    fireEvent.change(screen.getByLabelText(/nad czym mamy pracować/i), {
      target: { value: "Add warehouse alerts" },
    });
    fireEvent.change(screen.getByLabelText(/skontaktuj się ze mną/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /wyślij/i }));

    expect(screen.getByRole("button", { name: /wysyłanie/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockSuccess).toHaveBeenCalledWith("Dziękujemy za Twoją sugestię!");
    expect(screen.getByLabelText(/nad czym mamy pracować/i)).toHaveValue("");
    expect(screen.getByLabelText(/skontaktuj się ze mną/i)).toHaveValue("");
  });
});
