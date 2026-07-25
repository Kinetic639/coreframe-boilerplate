import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

import FeaturesContactForm from "../FeaturesContactForm";

describe("FeaturesContactForm", () => {
  afterEach(() => {
    vi.useRealTimers();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("shows an error toast when no suggestion is provided", () => {
    render(<FeaturesContactForm />);

    fireEvent.click(screen.getByRole("button", { name: "Wyślij" }));

    expect(toastErrorMock).toHaveBeenCalledWith("Proszę opisać swoją sugestię");
  });

  it("submits successfully and resets the fields", async () => {
    render(<FeaturesContactForm />);

    fireEvent.change(screen.getByLabelText("Nad czym mamy pracować:"), {
      target: { value: "Dodajcie eksport CSV" },
    });
    fireEvent.change(screen.getByLabelText("Skontaktuj się ze mną na ten email:"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij" }));

    expect(screen.getByRole("button", { name: "Wysyłanie..." })).toBeDisabled();

    await waitFor(
      () => {
        expect(toastSuccessMock).toHaveBeenCalledWith("Dziękujemy za Twoją sugestię!");
      },
      { timeout: 1500 }
    );

    expect(screen.getByLabelText("Nad czym mamy pracować:")).toHaveValue("");
    expect(screen.getByLabelText("Skontaktuj się ze mną na ten email:")).toHaveValue("");
  });
});
