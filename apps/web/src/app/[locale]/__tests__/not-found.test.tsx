import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import GlobalNotFound from "../not-found";

describe("GlobalNotFound", () => {
  it("renders a 404 message and a link back home", () => {
    render(<GlobalNotFound />);

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByText("Error 404 - This page could not be found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });
});
