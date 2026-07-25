import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Avatar } from "../avatar";

describe("Avatar", () => {
  it("renders initials from fallback text", () => {
    render(<Avatar fallback="Alice Smith" />);

    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("renders the fallback icon when no fallback text is provided", () => {
    const { container } = render(<Avatar />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders image, square shape, custom size, and status indicator", () => {
    const { container } = render(
      <Avatar
        src="https://example.com/avatar.png"
        alt="Alice avatar"
        fallback="Alice Smith"
        size="xl"
        shape="square"
        status="busy"
        className="extra-class"
      />
    );

    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(container.querySelector(".h-16.w-16")).toBeInTheDocument();
    expect(container.querySelector(".rounded-md")).toBeInTheDocument();
    expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
    expect(container.querySelector(".extra-class")).toBeInTheDocument();
  });
});
