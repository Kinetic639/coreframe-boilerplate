import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { BackButton } from "../back-button";

describe("BackButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the label and goes back when clicked", () => {
    const backSpy = vi.fn();
    Object.defineProperty(window, "history", {
      value: { back: backSpy },
      configurable: true,
    });

    render(<BackButton label="Go back" />);

    fireEvent.click(screen.getByRole("button", { name: /go back/i }));
    expect(backSpy).toHaveBeenCalled();
  });
});
