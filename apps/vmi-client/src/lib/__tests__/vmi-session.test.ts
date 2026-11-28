import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  apps: { data: [] as { organization_id: string; app: string }[] | null, error: null as unknown },
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "pl" }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    rpc: async () => mocks.apps,
  }),
}));

import { checkVmiAccess, getSwitcherApps, requireVmiAccess } from "../vmi-session";

describe("VMI access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "u1" };
    mocks.apps = { data: [{ organization_id: "o1", app: "vmi" }], error: null };
  });

  it("lets in a signed-in user whose organization has VMI", async () => {
    expect(await checkVmiAccess()).toBe("ok");
    await expect(requireVmiAccess()).resolves.toBeUndefined();
  });

  it("sends a signed-out user to the shared sign-in, back to VMI afterwards", async () => {
    mocks.user = null;
    expect(await checkVmiAccess()).toBe("signed-out");
    await expect(requireVmiAccess()).rejects.toThrow(
      /^redirect:.*\/logowanie\?returnUrl=.*%2Fportal$/
    );
  });

  it("sends a user without VMI to the app chooser", async () => {
    mocks.apps = { data: [{ organization_id: "o1", app: "erp" }], error: null };
    expect(await checkVmiAccess()).toBe("no-access");
    await expect(requireVmiAccess()).rejects.toThrow(/^redirect:.*\/aplikacje$/);
  });

  it("lets a signed-in user in when the rule cannot run", async () => {
    mocks.apps = { data: null, error: { message: "function does not exist" } };
    expect(await checkVmiAccess()).toBe("ok");
  });

  it("lists the user's apps for the switcher, in the usual order", async () => {
    mocks.apps = {
      data: [
        { organization_id: "o1", app: "vmi" },
        { organization_id: "o2", app: "erp" },
        { organization_id: "o1", app: "erp" },
        { organization_id: "o1", app: "unknown" },
      ],
      error: null,
    };
    expect(await getSwitcherApps()).toEqual(["erp", "vmi"]);
  });

  it("always offers VMI in the switcher, even when the rule cannot run", async () => {
    mocks.apps = { data: null, error: { message: "function does not exist" } };
    expect(await getSwitcherApps()).toEqual(["vmi"]);
  });
});
