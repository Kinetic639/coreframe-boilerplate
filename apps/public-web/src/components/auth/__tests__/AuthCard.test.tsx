import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../PrivacyTerms", () => ({
  PrivacyTerms: () => <div data-testid="privacy-terms" />,
}));

import { AuthCard } from "../AuthCard";

describe("AuthCard", () => {
  it("renders children and the visual panel by default", () => {
    const { container } = render(<AuthCard>Form content</AuthCard>);

    expect(screen.getByText("Form content")).toBeInTheDocument();
    expect(screen.getByTestId("privacy-terms")).toBeInTheDocument();
    expect(container.querySelector(".md\\:grid-cols-2")).toBeInTheDocument();
  });

  it("hides the image panel when showImage is false", () => {
    const { container } = render(
      <AuthCard showImage={false} variant="signup">
        Sign up
      </AuthCard>
    );

    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(container.querySelector(".md\\:block")).toBeNull();
  });
});
