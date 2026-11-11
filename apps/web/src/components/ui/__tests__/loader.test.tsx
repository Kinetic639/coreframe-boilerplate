import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/components/branding", () => ({
  BrandLoader: ({ label }: { label?: string }) => <div data-testid="brand-loader">{label}</div>,
}));

import Loader from "../Loader";

describe("Loader", () => {
  it("renders branding when organization data is present", () => {
    render(
      <Loader
        logoUrl="https://cdn.example.com/logo.png"
        orgName="Acme"
        orgName2="Warehouse"
        message="Preparing"
        fullScreen
      />
    );

    expect(screen.getByAltText("Acme logo")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Warehouse")).toBeInTheDocument();
    expect(screen.getByText("Preparing")).toBeInTheDocument();
    expect(screen.getByTestId("brand-loader")).toBeInTheDocument();
  });

  it("renders fallback content without branding", () => {
    render(<Loader message="Loading data" className="extra-class" />);

    expect(screen.queryByAltText(/logo/i)).not.toBeInTheDocument();
    expect(screen.getByText("Loading data")).toBeInTheDocument();
  });

  it("shows the animated brand logo with the common loading label by default", () => {
    render(<Loader />);

    expect(screen.getByTestId("brand-loader")).toHaveTextContent("loading");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
