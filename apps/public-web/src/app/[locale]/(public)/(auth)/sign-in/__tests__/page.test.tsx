import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/forms/sign-in-form", () => ({
  SignInForm: ({ message, returnUrl }: { message?: unknown; returnUrl?: string }) => (
    <div>{JSON.stringify({ message, returnUrl })}</div>
  ),
}));

vi.mock("@/lib/metadata", () => ({
  generatePageMetadata: vi.fn(),
}));

import Login from "../page";

describe("SignIn page", () => {
  it("passes search params to the sign in form", async () => {
    const page = await Login({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ message: "hello", returnUrl: "/dashboard/start" }),
    });

    render(page);

    expect(
      screen.getByText(
        '{"message":{"message":"hello","returnUrl":"/dashboard/start"},"returnUrl":"/dashboard/start"}'
      )
    ).toBeInTheDocument();
  });
});
