import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/v2/utility/avatar", () => ({
  Avatar: ({ alt, fallback, status }: any) => (
    <div>
      {alt ?? fallback}:{status}
    </div>
  ),
}));

vi.mock("@/components/v2/forms/search-form", () => ({
  SearchForm: ({ value, onSearch, onClear }: any) => (
    <div>
      <input
        aria-label="search contacts"
        value={value}
        onChange={(event) => onSearch(event.target.value)}
      />
      <button type="button" onClick={onClear}>
        clear search
      </button>
    </div>
  ),
}));

vi.mock("@/components/v2/feedback/loading-skeleton", () => ({
  LoadingSkeleton: () => <div data-testid="loading-skeleton" />,
}));

import { HeaderContacts } from "../header-contacts";

describe("HeaderContacts", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/" },
    });
  });

  it("filters contacts by type and search query", () => {
    render(<HeaderContacts />);

    expect(screen.getByText("John Smith")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    expect(screen.getByText("David Brown")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("search contacts"), {
      target: { value: "Emily" },
    });
    expect(screen.getByText("Emily Wilson")).toBeInTheDocument();
    expect(screen.queryByText("David Brown")).not.toBeInTheDocument();
  });

  it("clears search and shows the empty state when nothing matches", () => {
    render(<HeaderContacts />);

    fireEvent.change(screen.getByLabelText("search contacts"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No contacts found")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  it("triggers email and call actions for a contact", () => {
    render(<HeaderContacts />);

    fireEvent.click(screen.getAllByRole("button", { name: "Email" })[0]);
    expect(window.location.href).toBe("mailto:john.smith@email.com");

    fireEvent.click(screen.getAllByRole("button", { name: "Call" })[0]);
    expect(window.location.href).toBe("tel:+1 (555) 111-2222");
  });
});
