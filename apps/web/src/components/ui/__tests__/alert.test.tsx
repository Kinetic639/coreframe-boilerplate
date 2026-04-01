import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "../alert";

describe("Alert", () => {
  it("renders default alert content", () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>
          <p>Important message</p>
        </AlertDescription>
      </Alert>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Important message")).toBeInTheDocument();
  });

  it("applies destructive styling", () => {
    render(<Alert variant="destructive">Danger</Alert>);

    expect(screen.getByRole("alert")).toHaveClass("text-destructive");
  });
});
