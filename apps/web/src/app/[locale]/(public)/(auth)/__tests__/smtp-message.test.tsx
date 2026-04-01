import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SmtpMessage } from "../smtp-message";

describe("SmtpMessage", () => {
  it("renders the SMTP rate-limit note and external docs link", () => {
    render(<SmtpMessage />);

    expect(screen.getByText(/emails are rate limited/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /learn more/i })).toHaveAttribute(
      "href",
      "https://supabase.com/docs/guides/auth/auth-smtp"
    );
  });
});
