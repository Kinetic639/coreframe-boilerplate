import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import AnnouncementBanner from "../AnnouncementBanner";

describe("AnnouncementBanner", () => {
  it("renders external links and can be dismissed", () => {
    render(
      <AnnouncementBanner
        message="Important update"
        link="https://example.com"
        linkText="Learn more"
        external
      />
    );

    expect(screen.getByText("Important update")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /learn more/i })).toHaveAttribute(
      "href",
      "https://example.com"
    );

    fireEvent.click(screen.getByRole("button", { name: /zamknij ogłoszenie/i }));
    expect(screen.queryByText("Important update")).not.toBeInTheDocument();
  });

  it("hides on downward scroll and shows on upward scroll", () => {
    const { container } = render(<AnnouncementBanner message="Scroll me" />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
    fireEvent.scroll(window);
    expect(container.firstChild).toHaveClass("h-0");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 20 });
    fireEvent.scroll(window);
    expect(container.firstChild).toHaveClass("py-2");
  });
});
