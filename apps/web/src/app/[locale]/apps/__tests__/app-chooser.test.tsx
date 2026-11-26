import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../../../messages/pl.json";

const { setOpenLastAppAction } = vi.hoisted(() => ({ setOpenLastAppAction: vi.fn() }));
// Real translations: the global setup stubs next-intl to echo keys.
vi.unmock("next-intl");
vi.mock("../actions", () => ({ setOpenLastAppAction }));
vi.mock("@/app/[locale]/actions", () => ({ signOutAction: vi.fn() }));

import { AppChooser, type AppChooserProps } from "../_components/app-chooser";

const baseProps: AppChooserProps = {
  apps: [
    { id: "erp", href: "https://app.example/dashboard/start" },
    { id: "requests", href: "https://zapytania.example/" },
  ],
  lastApp: "erp",
  openLast: false,
  firstName: "Anna",
  email: "anna@example.com",
  organizationName: "Hurtownia Przykład",
  dateLabel: "Czwartek, 26 listopada",
  evening: true,
};

function renderChooser(props: Partial<AppChooserProps> = {}) {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <AppChooser {...baseProps} {...props} />
    </NextIntlClientProvider>
  );
}

describe("AppChooser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the user's apps as links", () => {
    renderChooser();
    expect(screen.getByRole("link", { name: /Ambra ERP/ })).toHaveAttribute(
      "href",
      "https://app.example/dashboard/start"
    );
    expect(screen.getByRole("link", { name: /Zgłoszenia/ })).toHaveAttribute(
      "href",
      "https://zapytania.example/"
    );
    expect(screen.queryByRole("link", { name: /VMI/ })).not.toBeInTheDocument();
  });

  it("greets the user with the organization, e-mail and sign-out", () => {
    renderChooser();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dobry wieczór,Anna");
    expect(screen.getByText("Hurtownia Przykład")).toBeInTheDocument();
    expect(screen.getByText(/anna@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wyloguj" })).toBeInTheDocument();
  });

  it("says good morning during the day", () => {
    renderChooser({ evening: false });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dzień dobry,Anna");
  });

  it("marks the last app used", () => {
    renderChooser();
    expect(screen.getByRole("link", { name: /Ambra ERP/ })).toHaveTextContent("Ostatnio");
    expect(screen.getByRole("link", { name: /Zgłoszenia/ })).not.toHaveTextContent("Ostatnio");
  });

  it("saves 'open my last app' when ticked", async () => {
    setOpenLastAppAction.mockResolvedValue({ success: true });
    renderChooser();
    const checkbox = screen.getByRole("checkbox", {
      name: "Następnym razem otwieraj od razu ostatnią aplikację",
    });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    await waitFor(() => expect(setOpenLastAppAction).toHaveBeenCalledWith(true));
  });

  it("unticks the box again when saving fails", async () => {
    setOpenLastAppAction.mockResolvedValue({ success: false });
    renderChooser();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });
});
