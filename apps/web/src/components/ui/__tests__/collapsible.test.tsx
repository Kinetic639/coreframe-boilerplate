import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";

describe("Collapsible", () => {
  it("toggles content visibility", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>
    );

    expect(screen.queryByText("Hidden content")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /toggle/i }));
    expect(screen.getByText("Hidden content")).toBeVisible();
  });
});
