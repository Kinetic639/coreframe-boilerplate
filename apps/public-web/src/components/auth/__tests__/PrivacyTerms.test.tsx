import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "privacyTerms.prefix": "By continuing you agree to",
      "privacyTerms.terms": "Terms",
      "privacyTerms.separator": "and",
      "privacyTerms.privacy": "Privacy Policy",
    })[key] ?? key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { PrivacyTerms } from "../PrivacyTerms";

describe("PrivacyTerms", () => {
  it("renders translated legal copy and links", () => {
    render(<PrivacyTerms />);

    expect(screen.getByText(/By continuing you agree to/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/");
  });
});
