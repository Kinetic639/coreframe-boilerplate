import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  attention: vi.fn(),
  activity: vi.fn(),
  tasks: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "pl",
  getTranslations: async () => Object.assign((key: string) => key, { has: () => false }),
}));
vi.mock("@/i18n/navigation", () => ({
  redirect: mocks.redirect,
  Link: ({ href, children }: { href: string | { pathname: string }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname}>{children}</a>
  ),
}));
vi.mock("../_lib/data", () => ({
  loadHomeContext: mocks.context,
  loadAttention: mocks.attention,
  loadHomeActivity: mocks.activity,
  loadOpenTaskCount: mocks.tasks,
}));
vi.mock("../_components/scope-boundary", () => ({
  HomeScopeBoundary: ({
    children,
  }: {
    children: ReactNode | ((refreshControl: ReactNode) => ReactNode);
  }) => <div>{typeof children === "function" ? children(<button>Refresh</button>) : children}</div>,
}));
import Page from "../page";
import { AttentionWidget } from "../_components/attention-widget";
import { ActivityWidget } from "../_components/activity-widget";
import { QuickActions } from "../_components/home-sections";
import { OperationalOverview } from "../_components/operational-overview";
import { homeCopy } from "../_lib/copy";
const copy = homeCopy("pl");
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
describe("home composition and widget states", () => {
  it("renders an honest no-context page without fetching optional widgets", async () => {
    mocks.context.mockResolvedValue({
      orgId: null,
      orgName: null,
      branchId: null,
      branchName: null,
      actions: [],
    });
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Pulpit", hidden: true })
    ).toBeInTheDocument();
    expect(screen.getByText(copy.noContext)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(mocks.attention).not.toHaveBeenCalled();
    expect(mocks.activity).not.toHaveBeenCalled();
  });
  it("redirects an unauthenticated request before rendering", async () => {
    mocks.context.mockResolvedValue(null);
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith({ href: "/sign-in", locale: "pl" });
  });
  it("renders only authorized shortcut links", () => {
    render(<QuickActions actions={["tools"]} copy={copy} />);
    expect(screen.getByRole("heading", { name: copy.actions })).toHaveClass("sr-only");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/dashboard/tools");
    expect(screen.queryByText(copy.tickets)).not.toBeInTheDocument();
  });
  it("shows only real available summary metrics and repeats them as module signals", async () => {
    render(
      await OperationalOverview({
        actions: ["tickets", "tasks"],
        copy,
        attentionResult: Promise.resolve({
          state: "ready",
          data: { rows: [], totalCount: 4, page: 1, pageSize: 5, priorityConfigs: null },
        }),
        taskResult: Promise.resolve({ state: "ready", data: { totalCount: 7 } }),
      })
    );
    expect(screen.getByText(copy.attentionMetric)).toBeInTheDocument();
    expect(screen.getByText(copy.tasksMetric)).toBeInTheDocument();
    expect(screen.getByText("4 wymagają uwagi")).toBeInTheDocument();
    expect(screen.getByText("7 otwartych")).toBeInTheDocument();
  });
  it("shows a specific empty queue, not a claim that all work is complete", async () => {
    mocks.attention.mockResolvedValue({
      state: "ready",
      data: { rows: [], totalCount: 0, priorityConfigs: null },
    });
    render(await AttentionWidget({ orgId: "org", branchId: "a", copy }));
    expect(screen.getByText(copy.attentionEmpty)).toBeInTheDocument();
    expect(screen.getByText(copy.attentionEmptyDescription)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.queue })).toBeInTheDocument();
  });
  it("renders the real count independently from the bounded preview length", async () => {
    mocks.attention.mockResolvedValue({
      state: "ready",
      data: {
        totalCount: 12,
        priorityConfigs: { urgent: { label: "Pilne", color: "#dc2626" } },
        rows: [
          {
            id: "t",
            ticket_number: "HD-100",
            title: "Damaged part",
            priority: "urgent",
            ticket_type_name: "Reklamacja",
            ticket_type_color: "#7c3aed",
          },
        ],
      },
    });
    render(await AttentionWidget({ orgId: "org", branchId: "a", copy }));
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Pokazano 1 z 12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Damaged part/ })).toBeInTheDocument();
    const priorityBadges = screen.getAllByTitle("Pilne");
    expect(priorityBadges).toHaveLength(2);
    priorityBadges.forEach((badge) => expect(badge).toHaveStyle({ color: "rgb(220, 38, 38)" }));
    expect(screen.getAllByText("Reklamacja")[0]).toHaveStyle({
      borderColor: "#7c3aed",
    });
  });
  it("keeps the queue link usable on a read failure and does not show a false zero", async () => {
    mocks.attention.mockResolvedValue({ state: "unavailable" });
    render(await AttentionWidget({ orgId: "org", branchId: "a", copy }));
    expect(screen.getByRole("status")).toHaveTextContent(copy.unavailable);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.queue })).toBeInTheDocument();
  });
  it("shows a bounded activity empty state after excluding another branch", async () => {
    mocks.activity.mockResolvedValue({
      state: "ready",
      data: { events: [{ id: "foreign", branch_id: "b", summary: "Private elsewhere" }] },
    });
    render(await ActivityWidget({ branchId: "a", locale: "pl", copy }));
    expect(screen.getByText(copy.activityEmpty)).toBeInTheDocument();
    expect(screen.queryByText("Private elsewhere")).not.toBeInTheDocument();
  });
  it("renders activity failure independently", async () => {
    mocks.activity.mockResolvedValue({ state: "unavailable" });
    render(await ActivityWidget({ branchId: "a", locale: "pl", copy }));
    expect(screen.getByRole("status")).toHaveTextContent(copy.unavailable);
  });
});
