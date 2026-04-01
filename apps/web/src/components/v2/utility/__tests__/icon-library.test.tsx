import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Icon, getAvailableIcons, searchIcons } from "../icon-library";

describe("IconLibrary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a lucide icon with configured props", () => {
    const { container } = render(
      <Icon name="User" size={18} className="text-primary" strokeWidth={1.5} />
    );

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("width", "18");
    expect(icon).toHaveClass("text-primary");
    expect(icon).toHaveAttribute("stroke-width", "1.5");
  });

  it("lists available icons and supports case-insensitive search", () => {
    expect(getAvailableIcons()).toContain("User");
    expect(searchIcons("user")).toContain("User");
    expect(searchIcons("USER")).toContain("User");
  });

  it("returns no results for unmatched searches", () => {
    expect(searchIcons("definitely-not-a-real-icon")).toEqual([]);
  });

  it("warns and renders nothing for invalid icon names", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<Icon name={"MissingIcon" as never} />);

    expect(container.firstChild).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Icon "MissingIcon" not found in lucide-react');
  });
});
