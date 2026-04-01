import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";

import { Tooltip } from "../tooltip";

describe("v2 Tooltip", () => {
  it("renders trigger children", () => {
    render(
      <Tooltip content="Helpful copy">
        <button type="button">Hover me</button>
      </Tooltip>
    );

    expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
  });

  it("shows tooltip content on hover", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Helpful copy" side="right" align="start" className="tooltip-extra">
        <button type="button">Hover me</button>
      </Tooltip>
    );

    await user.hover(screen.getByRole("button", { name: "Hover me" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Helpful copy");
  });
});
