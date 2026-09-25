import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  user: vi.fn(),
  entitlements: vi.fn(),
  tickets: vi.fn(),
  settings: vi.fn(),
  tasks: vi.fn(),
  activity: vi.fn(),
  client: {},
}));
vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: mocks.context,
}));
vi.mock("@/server/loaders/v2/load-user-context.v2", () => ({ loadUserContextV2: mocks.user }));
vi.mock("@/server/services/entitlements-service", () => ({
  EntitlementsService: { loadEntitlements: mocks.entitlements },
}));
vi.mock("@/server/services/helpdesk-tickets.service", () => ({
  HelpdeskTicketsService: { listForDataView: mocks.tickets },
}));
vi.mock("@/server/services/helpdesk-ticket-types.service", () => ({
  HelpdeskTicketTypesService: { getSettings: mocks.settings },
}));
vi.mock("@/server/services/planning-tasks.service", () => ({
  PlanningTasksService: { listForDataView: mocks.tasks },
}));
vi.mock("@/app/actions/audit/get-personal-activity", () => ({
  getPersonalActivityAction: mocks.activity,
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => mocks.client }));
import { loadHomeContext, loadAttention, loadHomeActivity, loadOpenTaskCount } from "../_lib/data";

const a = { id: "a", name: "Alpha", organization_id: "org" };
const b = { id: "b", name: "Beta", organization_id: "org" };
const context = () => ({
  app: {
    activeOrgId: "org",
    activeOrg: { name: "Grupa", name_2: "Example" },
    activeBranchId: "a",
    activeBranch: a,
    accessibleBranches: [a, b],
  },
  user: { permissionSnapshot: { allow: ["*"], deny: [] } },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue(context());
  mocks.entitlements.mockResolvedValue({ enabled_modules: ["warehouse", "help-desk", "planning"] });
  mocks.user.mockResolvedValue({ permissionSnapshot: { allow: [], deny: [] } });
  mocks.settings.mockResolvedValue({ success: true, data: null });
});
describe("authorized home scope", () => {
  it("returns no context for an unauthenticated request", async () => {
    mocks.context.mockResolvedValue(null);
    expect(await loadHomeContext()).toBeNull();
    expect(mocks.entitlements).not.toHaveBeenCalled();
  });
  it("composes the full organization label and resolved branch", async () => {
    expect(await loadHomeContext()).toMatchObject({ orgName: "Grupa Example", branchId: "a" });
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("reloads permissions for an accessible tab-selected branch", async () => {
    expect(await loadHomeContext("b")).toMatchObject({ branchId: "b", actions: [] });
    expect(mocks.user).toHaveBeenCalledWith("org", "b");
  });
  it("never uses an arbitrary branch supplied in the URL", async () => {
    expect(await loadHomeContext("foreign")).toMatchObject({ branchId: "a" });
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("rejects foreign-org branches even if erroneously present in the branch list", async () => {
    const ctx = context();
    ctx.app.accessibleBranches.push({ id: "foreign", name: "Foreign", organization_id: "other" });
    mocks.context.mockResolvedValue(ctx);
    expect(await loadHomeContext("foreign")).toMatchObject({ branchId: "a" });
  });
  it("fails module gates closed if the entitlement read fails", async () => {
    mocks.entitlements.mockRejectedValue(new Error("offline"));
    expect(await loadHomeContext()).toMatchObject({ actions: ["tools"] });
  });
  it("handles no organization or accessible branch without broadening a query", async () => {
    mocks.context.mockResolvedValue({
      ...context(),
      app: {
        activeOrgId: null,
        activeOrg: null,
        activeBranchId: null,
        activeBranch: null,
        accessibleBranches: [],
      },
    });
    expect(await loadHomeContext()).toMatchObject({ orgId: null, branchId: null, actions: [] });
    expect(mocks.entitlements).not.toHaveBeenCalled();
  });
});
describe("bounded existing data adapters", () => {
  it("passes org and exact active branch to the authenticated ticket service with a five-row limit", async () => {
    mocks.tickets.mockResolvedValue({ success: true, data: { rows: [], totalCount: 0 } });
    await loadAttention("org", "b");
    expect(mocks.tickets).toHaveBeenCalledWith(
      mocks.client,
      "org",
      expect.objectContaining({
        page: 1,
        pageSize: 5,
        filters: expect.objectContaining({ branchId: "b" }),
      })
    );
    expect(mocks.settings).toHaveBeenCalledWith(mocks.client, "org");
  });
  it("adds organization priority styling without making settings a widget dependency", async () => {
    mocks.tickets.mockResolvedValue({ success: true, data: { rows: [], totalCount: 0 } });
    mocks.settings.mockResolvedValue({
      success: true,
      data: { priority_configs: { urgent: { label: "Pilne", color: "#dc2626" } } },
    });
    await expect(loadAttention("org", "b")).resolves.toMatchObject({
      state: "ready",
      data: { priorityConfigs: { urgent: { label: "Pilne", color: "#dc2626" } } },
    });

    mocks.settings.mockRejectedValue(new Error("settings unavailable"));
    await expect(loadAttention("org", "b")).resolves.toMatchObject({
      state: "ready",
      data: { priorityConfigs: null },
    });
  });
  it("reuses the existing personal activity visibility projection with bounded pagination", async () => {
    mocks.activity.mockResolvedValue({ success: true, data: { events: [] } });
    expect(await loadHomeActivity()).toMatchObject({ state: "ready" });
    expect(mocks.activity).toHaveBeenCalledWith(10, 0);
  });
  it("counts organization-wide tasks together with tasks from the active branch", async () => {
    mocks.tasks.mockResolvedValue({
      success: true,
      data: { rows: [], totalCount: 7, page: 1, pageSize: 1 },
    });
    await expect(loadOpenTaskCount("org", "b")).resolves.toMatchObject({
      state: "ready",
      data: { totalCount: 7 },
    });
    expect(mocks.tasks).toHaveBeenCalledWith(
      mocks.client,
      "org",
      expect.objectContaining({ page: 1, pageSize: 1 }),
      { branch_id_or_global: "b", status: ["open", "in_progress"] }
    );
  });
});
