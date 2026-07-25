import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

import FancySpinner from "../FancySpinner";

describe("FancySpinner", () => {
  it("renders all animated rings and center dot", () => {
    const { container } = render(<FancySpinner className="custom-size" />);

    expect(container.firstChild).toHaveClass("custom-size");
    expect(container.querySelectorAll(".absolute.rounded-full")).toHaveLength(3);
    expect(container.querySelector(".z-10")).toBeInTheDocument();
  });
});
