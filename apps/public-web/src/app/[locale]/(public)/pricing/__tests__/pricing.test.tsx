import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange, min, max, step }: any) => (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(event) => onValueChange([Number(event.target.value)])}
    />
  ),
}));

vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ value, onValueChange, children }: any) => (
    <div data-value={value}>
      {Array.isArray(children)
        ? children.map((child) =>
            child ? React.cloneElement(child, { currentValue: value, onValueChange }) : child
          )
        : children}
    </div>
  ),
  ToggleGroupItem: ({ children, value, currentValue, onValueChange }: any) => (
    <button
      type="button"
      aria-pressed={currentValue === value}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  ),
}));

import Pricing from "../pricing";

describe("Pricing", () => {
  it("renders plans, faq, and contact form", () => {
    render(<Pricing />);

    expect(screen.getByRole("heading", { name: /przejrzysty cennik/i })).toBeInTheDocument();
    expect(screen.getByText("Podstawowy")).toBeInTheDocument();
    expect(screen.getByText("Profesjonalny")).toBeInTheDocument();
    expect(screen.getByText("Biznes")).toBeInTheDocument();
    expect(screen.getByText("Plan Niestandardowy")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /często zadawane pytania/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wyślij/i })).toBeInTheDocument();
  });

  it("switches to yearly billing and updates displayed plan prices", () => {
    render(<Pricing />);

    fireEvent.click(screen.getByRole("button", { name: /rocznie/i }));

    expect(screen.getAllByText(/20%/i).length).toBeGreaterThan(0);
    expect(screen.getByText("23 zł")).toBeInTheDocument();
    expect(screen.getByText("71 zł")).toBeInTheDocument();
    expect(screen.getByText("159 zł")).toBeInTheDocument();
  });

  it("recalculates the custom plan when sliders change", () => {
    render(<Pricing />);

    expect(screen.getByText("94 zł")).toBeInTheDocument();

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "20" } });
    fireEvent.change(sliders[1], { target: { value: "20" } });
    fireEvent.change(sliders[2], { target: { value: "5000" } });

    expect(screen.getByText("224 zł")).toBeInTheDocument();
    expect(screen.getByText(/5[ ,]000/)).toBeInTheDocument();
  });
});
