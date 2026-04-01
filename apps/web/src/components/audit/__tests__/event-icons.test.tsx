import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventCategoryIcon, EventIntentIcon } from "../event-icons";

describe("event-icons", () => {
  it("renders the category icon with merged classes", () => {
    const { container } = render(<EventCategoryIcon category="AUTH" className="custom-class" />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveClass("h-4", "w-4", "custom-class");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("applies intent colors by default and can disable them", () => {
    const colored = render(<EventIntentIcon intent="SUCCESS" className="intent-class" />);
    expect(colored.container.querySelector("svg")).toHaveClass("text-green-600", "intent-class");

    const plain = render(<EventIntentIcon intent="FAIL" colored={false} />);
    expect(plain.container.querySelector("svg")).toHaveClass("h-3", "w-3");
    expect(plain.container.querySelector("svg")).not.toHaveClass("text-red-600");
  });
});
