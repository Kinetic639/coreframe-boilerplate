import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "privacyTerms.prefix": "By continuing you agree to the",
      "privacyTerms.terms": "Terms",
      "privacyTerms.separator": "and",
      "privacyTerms.privacy": "Privacy Policy",
    })[key] ?? key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { AuthCard } from "../AuthCard";

describe("AuthCard", () => {
  it("renders children and privacy terms", () => {
    render(<AuthCard>form body</AuthCard>);

    expect(screen.getByText("form body")).toBeInTheDocument();
    expect(screen.getByText(/by continuing you agree/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("omits the decorative image when disabled", () => {
    const { container } = render(
      <AuthCard showImage={false} variant="signup">
        content
      </AuthCard>
    );

    expect(container.querySelector(".relative.hidden.md\\:block")).toBeNull();
  });
});
