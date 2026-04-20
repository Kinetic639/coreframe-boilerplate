import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import AnnouncementBanner from "../AnnouncementBanner";

describe("AnnouncementBanner", () => {
  it("renders message with internal link", () => {
    render(<AnnouncementBanner message="Hello" link="/pricing" linkText="Read more" />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /read more/i })).toHaveAttribute("href", "/pricing");
  });

  it("renders external link and dismisses the banner", () => {
    render(
      <AnnouncementBanner message="External" link="https://example.com" linkText="Open" external />
    );

    expect(screen.getByRole("link", { name: /open/i })).toHaveAttribute(
      "href",
      "https://example.com"
    );
    fireEvent.click(screen.getByRole("button", { name: /zamknij ogłoszenie/i }));
    expect(screen.queryByText("External")).not.toBeInTheDocument();
  });

  it("collapses when the user scrolls down", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
    render(<AnnouncementBanner message="Scroll banner" />);

    fireEvent.scroll(window);

    const banner =
      screen.getByText("Scroll banner").closest("div")?.parentElement?.parentElement ?? null;
    expect(banner).toHaveClass("opacity-0");
  });
});
