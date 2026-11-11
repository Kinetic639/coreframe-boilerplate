import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentionChip } from "../mention-chip";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
let granted: string[] = [];
vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: () => ({ can: (permission: string) => granted.includes(permission) }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: React.ReactNode;
  }) => (
    <a
      href={typeof href === "string" ? href : `${href.pathname}?${new URLSearchParams(href.query)}`}
      {...rest}
    >
      {children}
    </a>
  ),
}));

const order = {
  type: "repairOrder",
  id: "r1",
  label: "Golf VII — wymiana klocków",
  code: "174232",
  href: "/dashboard/workshop/r1",
};

const PERSON_ID = "832858c3-0a9f-4f9f-a230-fc7e47855e78";

describe("MentionChip", () => {
  it("a person links to their contact card, or the member page, as the reader's permissions allow", () => {
    granted = ["crm.contacts.read"];
    const { rerender } = render(
      <MentionChip mention={{ type: "person", id: PERSON_ID, label: "Anna Nowak" }} access="ok" />
    );
    expect(screen.getByRole("link", { name: "@Anna Nowak" })).toHaveAttribute(
      "href",
      `/dashboard/crm/contacts?selected=member%3A${PERSON_ID}`
    );
    granted = ["members.read"];
    rerender(
      <MentionChip mention={{ type: "person", id: PERSON_ID, label: "Anna Nowak" }} access="ok" />
    );
    expect(screen.getByRole("link", { name: "@Anna Nowak" })).toHaveAttribute(
      "href",
      `/dashboard/organization/users/members/${PERSON_ID}`
    );
    granted = [];
    rerender(
      <MentionChip mention={{ type: "person", id: PERSON_ID, label: "Anna Nowak" }} access="ok" />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("@Anna Nowak")).toBeInTheDocument();
  });

  it("a person is a tag; the reader's own mention stands out", () => {
    granted = [];
    const { rerender } = render(
      <MentionChip mention={{ type: "person", id: "u1", label: "Anna Nowak" }} access="ok" />
    );
    expect(screen.getByText("@Anna Nowak")).not.toHaveClass("bg-amber-200/80");
    rerender(
      <MentionChip
        mention={{ type: "person", id: "u1", label: "Anna Nowak" }}
        access="ok"
        meId="u1"
      />
    );
    expect(screen.getByText("@Anna Nowak")).toHaveClass("bg-amber-200/80");
  });

  it("an object the reader may open is a link with its number", () => {
    render(<MentionChip mention={order} access="ok" />);
    const link = screen.getByRole("link", { name: "174232" });
    expect(link).toHaveAttribute("href", "/dashboard/workshop/r1");
    expect(link).toHaveAttribute("title", "Golf VII — wymiana klocków");
  });

  it("without access: a neutral tag, no number, no name, no link", () => {
    render(<MentionChip mention={order} access="denied" />);
    expect(screen.getByText("noAccess")).toBeInTheDocument();
    expect(screen.queryByText("174232")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("while access is being checked the number shows without a link", () => {
    render(<MentionChip mention={order} access="pending" />);
    expect(screen.getByText("174232")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("never links outside the dashboard, whatever the stored href says", () => {
    render(<MentionChip mention={{ ...order, href: "https://evil.example/x" }} access="ok" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("174232")).toBeInTheDocument();
  });
});
