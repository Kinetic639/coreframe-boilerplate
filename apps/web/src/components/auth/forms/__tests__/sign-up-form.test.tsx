import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { signUpActionMock, fetchInvitationByTokenMock } = vi.hoisted(() => ({
  signUpActionMock: vi.fn(),
  fetchInvitationByTokenMock: vi.fn(),
}));

vi.mock("@/app/[locale]/actions", () => ({
  signUpAction: signUpActionMock,
}));

vi.mock("@/lib/api/invitations", () => ({
  fetchInvitationByToken: fetchInvitationByTokenMock,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { SignUpForm } from "../sign-up-form";

describe("SignUpForm", () => {
  beforeEach(() => {
    signUpActionMock.mockReset();
    fetchInvitationByTokenMock.mockReset();
  });

  it("renders the default sign-up state without invitation details", () => {
    render(<SignUpForm message={{ message: "Hello" }} />);

    expect(screen.getByRole("link", { name: "signIn" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByLabelText("emailLabel")).toBeEnabled();
  });

  it("loads invitation details, disables email editing, and submits the token", async () => {
    fetchInvitationByTokenMock.mockResolvedValue({
      status: "pending",
      email: "invitee@example.com",
      organization: { name: "Acme Org" },
      role: { name: "member", display_name: "Member" },
      branch: { name: "Warsaw" },
    });
    signUpActionMock.mockResolvedValue(undefined);

    render(<SignUpForm invitationToken="token-123" />);

    expect(await screen.findByText("invitationTo Acme Org")).toBeInTheDocument();
    expect(screen.getByText("invitationRole Member")).toBeInTheDocument();
    expect(screen.getByText("invitationBranch Warsaw")).toBeInTheDocument();

    const emailInput = screen.getByLabelText("emailLabel") as HTMLInputElement;
    expect(emailInput.value).toBe("invitee@example.com");
    expect(emailInput).toBeDisabled();

    fireEvent.change(screen.getByLabelText("firstNameLabel"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("lastNameLabel"), { target: { value: "Lovelace" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => {
      expect(signUpActionMock).toHaveBeenCalledOnce();
    });

    const formData = signUpActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("email")).toBe("invitee@example.com");
    expect(formData.get("firstName")).toBe("Ada");
    expect(formData.get("lastName")).toBe("Lovelace");
    expect(formData.get("invitationToken")).toBe("token-123");
  });

  it("handles invitation lookup failures and keeps the form usable", async () => {
    fetchInvitationByTokenMock.mockRejectedValue(new Error("network"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SignUpForm invitationToken="bad-token" />);

    await waitFor(() => {
      expect(fetchInvitationByTokenMock).toHaveBeenCalledWith("bad-token");
    });

    expect(screen.getByLabelText("emailLabel")).toBeEnabled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
