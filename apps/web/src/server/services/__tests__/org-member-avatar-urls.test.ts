/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgMemberPublicProfileService } from "../org-member-public-profile.service";

const { mockCreateServiceClient, mockCreateSignedUrls } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockCreateSignedUrls: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({ createServiceClient: mockCreateServiceClient }));

function query(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in"]) q[method] = vi.fn().mockReturnValue(q);
  q["maybeSingle"] = vi.fn().mockResolvedValue(result);
  q["then"] = (onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return q;
}

function supabaseWith(memberships: unknown[], users: unknown[], signedIn = true) {
  const queries = [
    // The viewer's own membership (authorization), then the people asked for, then their profiles
    query({ data: { user_id: "viewer" }, error: null }),
    query({ data: memberships, error: null }),
    query({ data: users, error: null }),
  ];
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: signedIn ? { id: "viewer" } : null }, error: null }),
    },
    from: vi.fn().mockImplementation(() => queries.shift()),
  } as never;
}

const user = (id: string, avatar_path: string | null, avatar_url: string | null = null) => ({
  id,
  email: null,
  first_name: null,
  last_name: null,
  avatar_url,
  avatar_path,
});

describe("OrgMemberPublicProfileService.avatarUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServiceClient.mockReturnValue({
      storage: { from: () => ({ createSignedUrls: mockCreateSignedUrls }) },
    });
  });

  it("signs private avatars in one call and keeps public URLs", async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ signedUrl: "https://signed/u1" }, { signedUrl: "https://signed/u3" }],
      error: null,
    });
    const supabase = supabaseWith(
      [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" }],
      [
        user("u1", "u1/avatar.png"),
        user("u2", null, "https://public/u2.png"),
        user("u3", "u3/a.jpg", "https://stale/u3"),
        user("u4", null),
      ]
    );

    const urls = await OrgMemberPublicProfileService.avatarUrls(supabase, "org", [
      "u1",
      "u2",
      "u3",
      "u4",
      "u1",
    ]);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(["u1/avatar.png", "u3/a.jpg"], 3600);
    expect(Object.fromEntries(urls)).toEqual({
      u1: "https://signed/u1",
      u2: "https://public/u2.png",
      u3: "https://signed/u3",
    });
  });

  it("never signs a path outside the user's own folder", async () => {
    const supabase = supabaseWith([{ user_id: "u1" }], [user("u1", "someone-else/secret.png")]);
    const urls = await OrgMemberPublicProfileService.avatarUrls(supabase, "org", ["u1"]);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
    expect(urls.size).toBe(0);
  });

  it("returns nothing for a signed-out viewer or people outside the organization", async () => {
    expect(
      (await OrgMemberPublicProfileService.avatarUrls(supabaseWith([], [], false), "org", ["u1"]))
        .size
    ).toBe(0);
    expect(
      (await OrgMemberPublicProfileService.avatarUrls(supabaseWith([], []), "org", ["u1"])).size
    ).toBe(0);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it("a failed signing keeps what is already known", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: { message: "boom" } });
    const supabase = supabaseWith(
      [{ user_id: "u1" }, { user_id: "u2" }],
      [user("u1", "u1/a.png"), user("u2", null, "https://public/u2.png")]
    );
    const urls = await OrgMemberPublicProfileService.avatarUrls(supabase, "org", ["u1", "u2"]);
    expect(Object.fromEntries(urls)).toEqual({ u2: "https://public/u2.png" });
  });
});
