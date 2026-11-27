import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import pl from "../../../../../messages/pl.json";

const { setDefaultAppAction } = vi.hoisted(() => ({
  setDefaultAppAction: vi.fn(async () => ({ success: true })),
}));
// Real translations: the global setup stubs next-intl to echo keys.
vi.unmock("next-intl");
vi.mock("@/app/[locale]/apps/actions", () => ({ setDefaultAppAction }));

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
    const website = screen.getByRole("menuitem", { name: /Strona Ambra/ });
    expect(website).toHaveAttribute("target", "_blank");
    expect(website).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("marks an app as opened after sign-in with the star, and clears it", async () => {
    document.cookie = "ambra-default-app=requests; path=/";
    renderSwitcher(["erp", "requests"]);
    await userEvent.click(screen.getByRole("button", { name: "Aplikacje Ambra" }));

    const requestsStar = await screen.findByRole("menuitemcheckbox", {
      name: "Nie otwieraj Zgłoszenia od razu po zalogowaniu",
    });
    expect(requestsStar).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: /Zgłoszenia/ })).toHaveTextContent(
      "Otwiera się po zalogowaniu"
    );

    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Otwieraj Ambra ERP od razu po zalogowaniu" })
    );
    expect(setDefaultAppAction).toHaveBeenLastCalledWith("erp");

    await userEvent.click(
      screen.getByRole("menuitemcheckbox", {
        name: "Nie otwieraj Ambra ERP od razu po zalogowaniu",
      })
    );
    expect(setDefaultAppAction).toHaveBeenLastCalledWith(null);
    document.cookie = "ambra-default-app=; path=/; max-age=0";
  });
});
