import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { FormMessage } from "../form-message";

describe("FormMessage", () => {
  it("renders success messages", () => {
    render(<FormMessage message={{ success: "Saved successfully" }} />);
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();
  });

  it("renders error messages", () => {
    render(<FormMessage message={{ error: "Something failed" }} />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });

  it("renders neutral messages", () => {
    render(<FormMessage message={{ message: "FYI" }} />);
    expect(screen.getByText("FYI")).toBeInTheDocument();
  });
});
