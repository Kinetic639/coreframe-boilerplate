import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockLoadUserContextV2 = vi.fn();

vi.mock("@/server/loaders/v2/load-user-context.v2", () => ({
  loadUserContextV2: () => mockLoadUserContextV2(),
}));

vi.mock("../PublicHeaderClient", () => ({
  PublicHeaderClient: () => <div>public-header-client</div>,
}));

vi.mock("../PublicHeaderAuth", () => ({
  PublicHeaderAuth: ({ userContext }: { userContext: unknown }) => (
    <div>{JSON.stringify(userContext)}</div>
  ),
}));

import PublicHeader from "../PublicHeader";

describe("PublicHeader", () => {
  it("loads user context and renders both header sections", async () => {
    mockLoadUserContextV2.mockResolvedValue({ user: { id: "u-1" } });

    const element = await PublicHeader();
    render(element);

    expect(mockLoadUserContextV2).toHaveBeenCalled();
    expect(screen.getByText("public-header-client")).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify({ user: { id: "u-1" } }))).toBeInTheDocument();
  });
});
