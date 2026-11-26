import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  loadAppContextV2: vi.fn(),
  loadMyAmbraApps: vi.fn(),
  cookies: new Map<string, string>(),
  redirect: vi.fn((arg: unknown) => {
    throw new Error(`redirect:${JSON.stringify(arg)}`);
  }),
  redirectToUrl: vi.fn((url: string) => {
    throw new Error(`redirect-url:${url}`);
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "pl",
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookies.has(name) ? { name, value: mocks.cookies.get(name) } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirectToUrl }));
vi.mock("@/i18n/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/get-auth-user", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/server/loaders/v2/load-app-context.v2", () => ({
  loadAppContextV2: mocks.loadAppContextV2,
}));
vi.mock("@/server/ambra-apps/load-my-ambra-apps", () => ({
  loadMyAmbraApps: mocks.loadMyAmbraApps,
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { first_name: "Anna" } }) }),
      }),
    }),
  }),
}));
vi.mock("../_components/app-chooser", () => ({
  AppChooser: (props: {
    apps: { id: string; href: string }[];
    firstName: string | null;
    lastApp: string | null;
  }) => (
    <div>
      chooser:{props.apps.map((a) => a.id).join(",")}:{props.firstName}:{String(props.lastApp)}
    </div>
  ),
}));
vi.mock("../_components/no-app-access", () => ({
  NoAppAccess: ({ email }: { email: string }) => <div>no-access:{email}</div>,
}));

import AppsPage from "../page";

function signedInWithOrg() {
  mocks.getAuthUser.mockResolvedValue({
    data: { user: { id: "u1", email: "anna@example.com", user_metadata: {} } },
  });
  mocks.loadAppContextV2.mockResolvedValue({
    activeOrgId: "org-1",
    activeOrg: { name: "Hurtownia" },
  });
}

describe("app chooser page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.clear();
    signedInWithOrg();
  });

  it("shows the chooser when the user has more than one app", async () => {
    mocks.loadMyAmbraApps.mockResolvedValue({ ok: true, apps: ["erp", "requests"] });
    mocks.cookies.set("ambra-last-app", "requests");
    render(await AppsPage());
    expect(screen.getByText("chooser:erp,requests:Anna:requests")).toBeInTheDocument();
  });

  it("opens the only app straight away", async () => {
    mocks.loadMyAmbraApps.mockResolvedValue({ ok: true, apps: ["requests"] });
    await expect(AppsPage()).rejects.toThrow(/^redirect-url:.*\/$/);
    expect(mocks.redirectToUrl).toHaveBeenCalledTimes(1);
  });

  it("opens the last app when the user asked for that", async () => {
    mocks.loadMyAmbraApps.mockResolvedValue({ ok: true, apps: ["erp", "requests"] });
    mocks.cookies.set("ambra-last-app", "erp");
    mocks.cookies.set("ambra-open-last-app", "1");
    await expect(AppsPage()).rejects.toThrow(/redirect-url:.*\/dashboard\/start$/);
  });

  it("shows no access when no app is open to the user", async () => {
    mocks.loadMyAmbraApps.mockResolvedValue({ ok: true, apps: [] });
    render(await AppsPage());
    expect(screen.getByText("no-access:anna@example.com")).toBeInTheDocument();
  });

  it("opens the ERP as before when the rule cannot run", async () => {
    mocks.loadMyAmbraApps.mockResolvedValue({ ok: false, apps: [] });
    await expect(AppsPage()).rejects.toThrow('redirect:{"href":"/dashboard/start","locale":"pl"}');
  });

  it("sends a user without an organization to onboarding", async () => {
    mocks.loadAppContextV2.mockResolvedValue({ activeOrgId: null });
    await expect(AppsPage()).rejects.toThrow('redirect:{"href":"/onboarding","locale":"pl"}');
  });
});
