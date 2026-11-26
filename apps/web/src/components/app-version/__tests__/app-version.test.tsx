import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Release } from "@repo/app-version";

const toastInfo = vi.fn();
vi.mock("react-toastify", () => ({ toast: { info: (...args: unknown[]) => toastInfo(...args) } }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
  useFormatter: () => ({ dateTime: (d: Date) => d.toISOString().slice(0, 10) }),
}));

const RELEASES: Release[] = [
  {
    version: "1.2.0",
    date: "2026-11-27",
    groups: [
      { kind: "patch", items: ["Fixed links"] },
      { kind: "minor", items: ["Help Desk dialog"] },
    ],
  },
  { version: "1.1.0", date: null, groups: [{ kind: "major", items: ["New sign-in"] }] },
];

beforeEach(() => {
  toastInfo.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("WhatsNewDialog", () => {
  it("lists releases with dates and kinds, new features before fixes", async () => {
    const { WhatsNewDialog } = await import("../whats-new-dialog");
    render(<WhatsNewDialog open onOpenChange={() => {}} releases={RELEASES} />);

    expect(screen.getByText("1.2.0")).toBeInTheDocument();
    expect(screen.getByText("2026-11-27")).toBeInTheDocument();
    expect(screen.getByText("Help Desk dialog")).toBeInTheDocument();
    expect(screen.getByText("kinds.major")).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(headings).toEqual(["kinds.minor", "kinds.patch", "kinds.major"]);
  });

  it("says so when nothing is described", async () => {
    const { WhatsNewDialog } = await import("../whats-new-dialog");
    render(<WhatsNewDialog open onOpenChange={() => {}} releases={[]} />);
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});

describe("SidebarVersion", () => {
  it("shows the build version and opens What's new", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.4.0");
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "a1b2c3d4e5f6");
    const { SidebarVersion } = await import("../sidebar-version");
    const { useWhatsNewStore } = await import("../whats-new-store");
    render(<SidebarVersion />);

    fireEvent.click(screen.getByRole("button", { name: "label:1.4.0 (a1b2c3d)" }));
    expect(useWhatsNewStore.getState().open).toBe(true);
  });
});

describe("AppVersionHost", () => {
  it("remembers the version silently on the first visit", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.4.0");
    const { AppVersionHost, LAST_SEEN_VERSION_KEY } = await import("../app-version-host");
    render(<AppVersionHost />);

    expect(window.localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe("1.4.0");
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("notes an update once the version is newer than the last one seen", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.4.0");
    const { AppVersionHost, LAST_SEEN_VERSION_KEY } = await import("../app-version-host");
    window.localStorage.setItem(LAST_SEEN_VERSION_KEY, "1.3.2");
    render(<AppVersionHost />);

    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo.mock.calls[0]?.[1]).toMatchObject({ toastId: "app-version-updated" });
    expect(window.localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe("1.4.0");
  });

  it("asks to reload when another deployment answers", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.4.0");
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "aaaaaaa");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "1.5.0", commit: "bbbbbbb" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { AppVersionHost } = await import("../app-version-host");
    render(<AppVersionHost />);

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/version", { cache: "no-store" });
    expect(toastInfo.mock.calls[0]?.[1]).toMatchObject({
      toastId: "app-version-available",
      autoClose: false,
    });
  });

  it("stays quiet when the same deployment answers", async () => {
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "aaaaaaa");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "1.4.0", commit: "aaaaaaa" }),
      })
    );
    const { AppVersionHost } = await import("../app-version-host");
    render(<AppVersionHost />);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("does not poll in a build without a commit", async () => {
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { AppVersionHost } = await import("../app-version-host");
    render(<AppVersionHost />);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
