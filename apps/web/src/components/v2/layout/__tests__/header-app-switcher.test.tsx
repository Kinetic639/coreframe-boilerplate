import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import pl from "../../../../../messages/pl.json";

// Real translations: the global setup stubs next-intl to echo keys.
vi.unmock("next-intl");

import { HeaderAppSwitcher } from "../header-app-switcher";

function renderSwitcher(apps: ("erp" | "requests" | "vmi")[]) {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <HeaderAppSwitcher apps={apps} />
    </NextIntlClientProvider>
  );
}

describe("HeaderAppSwitcher (ERP header)", () => {
  it("lists the user's apps, marks the ERP as current and links the public site", async () => {
    renderSwitcher(["erp", "requests"]);
    await userEvent.click(screen.getByRole("button", { name: "Aplikacje Ambra" }));

    const erp = await screen.findByRole("menuitem", { name: /Ambra ERP/ });
    expect(erp).toHaveAttribute("aria-current", "page");
    expect(erp).toHaveTextContent("Tutaj jesteś");
    expect(erp.getAttribute("href")).toMatch(/\/dashboard\/start$/);

    const requests = screen.getByRole("menuitem", { name: /Zgłoszenia/ });
    expect(requests).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("menuitem", { name: /VMI/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Strona Ambra" })).toBeInTheDocument();
  });
});
