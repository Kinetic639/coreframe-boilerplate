import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => `t:${key}`),
}));

import AuthCodeError from "../page";

describe("auth/auth-code-error page", () => {
  it("renders translated auth code error actions", async () => {
    render(await AuthCodeError());

    expect(screen.getByText("t:authCodeError.title")).toBeInTheDocument();
    expect(screen.getByText("t:authCodeError.description")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "t:authCodeError.requestNewLink" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByRole("link", { name: "t:authCodeError.backToSignIn" })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });
});
