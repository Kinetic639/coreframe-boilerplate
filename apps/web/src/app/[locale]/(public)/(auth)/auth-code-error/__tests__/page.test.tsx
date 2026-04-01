import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => `t:${key}`),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import AuthCodeErrorPage, { generateMetadata } from "../page";

describe("localized auth-code-error page", () => {
  it("generates translated metadata", async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: "t:title" });
  });

  it("renders translated content and consumes search params", async () => {
    render(await AuthCodeErrorPage({ searchParams: Promise.resolve({ error: "bad" }) }));

    expect(screen.getByText("t:title")).toBeInTheDocument();
    expect(screen.getByText("t:description")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "t:requestNewLink" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByRole("link", { name: "t:backToSignIn" })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });
});
