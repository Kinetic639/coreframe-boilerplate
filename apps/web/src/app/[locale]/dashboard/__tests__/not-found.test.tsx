import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => `t:${key}`),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../_components/back-button", () => ({
  BackButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

import DashboardNotFound from "../not-found";

describe("DashboardNotFound", () => {
  it("renders translated dashboard 404 content", async () => {
    render(await DashboardNotFound());

    expect(screen.getByText("t:title")).toBeInTheDocument();
    expect(screen.getByText("t:description")).toBeInTheDocument();
    expect(screen.getByText("t:content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /t:dashboardHome/i })).toHaveAttribute(
      "href",
      "/dashboard/start"
    );
    expect(screen.getByRole("button", { name: "t:goBack" })).toBeInTheDocument();
  });
});
