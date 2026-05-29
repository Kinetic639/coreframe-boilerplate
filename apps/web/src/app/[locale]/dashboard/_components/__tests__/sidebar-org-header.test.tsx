import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

import { SidebarOrgHeader } from "../sidebar-org-header";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";

describe("SidebarOrgHeader", () => {
  it("renders nothing when there is no active org", () => {
    vi.mocked(useAppStoreV2).mockReturnValue({ activeOrg: null });
    const { container } = render(<SidebarOrgHeader />);

    expect(container.firstChild).toBeNull();
  });

  it("renders org logo and secondary name when available", () => {
    vi.mocked(useAppStoreV2).mockReturnValue({
      activeOrg: {
        id: "org-1",
        name: "Main Org",
        name_2: "Warehouse Division",
        logo_url: "https://example.com/logo.png",
      },
    });

    render(<SidebarOrgHeader />);

    expect(screen.getByText("Main Org")).toBeInTheDocument();
    expect(screen.getByText("Warehouse Division")).toBeInTheDocument();
    expect(screen.getByAltText("Main Org")).toHaveAttribute("src", "https://example.com/logo.png");
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/dashboard/organization/public-profile"
    );
  });

  it("renders the fallback icon when the org has no logo", () => {
    vi.mocked(useAppStoreV2).mockReturnValue({
      activeOrg: {
        id: "org-1",
        name: "Main Org",
        name_2: null,
        logo_url: null,
      },
    });

    const { container } = render(<SidebarOrgHeader />);

    expect(screen.getByText("Main Org")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
