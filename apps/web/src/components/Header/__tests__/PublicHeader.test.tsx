import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../PublicHeaderClient", () => ({
  PublicHeaderClient: () => <div data-testid="public-header-client" />,
}));

vi.mock("../PublicHeaderAuth", () => ({
  PublicHeaderAuth: ({ userContext }: { userContext: unknown }) => (
    <div data-testid="public-header-auth">{JSON.stringify(userContext)}</div>
  ),
}));

vi.mock("@/server/loaders/v2/load-user-context.v2", () => ({
  loadUserContextV2: vi.fn().mockResolvedValue({ user: { id: "u-1" } }),
}));

import PublicHeader from "../PublicHeader";

describe("PublicHeader", () => {
  it("renders the client and auth sections with loaded user context", async () => {
    const element = await PublicHeader();
    render(element);

    expect(screen.getByTestId("public-header-client")).toBeInTheDocument();
    expect(screen.getByTestId("public-header-auth")).toHaveTextContent("u-1");
  });
});
