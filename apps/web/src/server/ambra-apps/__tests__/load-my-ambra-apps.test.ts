import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { loadMyAmbraApps } from "../load-my-ambra-apps";

describe("loadMyAmbraApps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the apps of the given organization in display order", async () => {
    rpc.mockResolvedValue({
      data: [
        { organization_id: "org-1", app: "vmi" },
        { organization_id: "org-1", app: "erp" },
        { organization_id: "org-2", app: "requests" },
        { organization_id: "org-1", app: "unknown" },
      ],
      error: null,
    });
    await expect(loadMyAmbraApps("org-1")).resolves.toEqual({ ok: true, apps: ["erp", "vmi"] });
    expect(rpc).toHaveBeenCalledWith("get_my_ambra_apps");
  });

  it("reports that the rule could not run so callers can fail open", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    await expect(loadMyAmbraApps("org-2")).resolves.toEqual({ ok: false, apps: [] });
  });
});
