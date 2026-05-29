/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgMemberPublicProfileService } from "../org-member-public-profile.service";

const { mockCreateServiceClient, mockStorageFrom, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

const ORG_ID = "org-1";
const VIEWER_ID = "viewer-1";
const USER_ID = "user-1";

function makeQuery(result: { data: unknown; error: unknown; count?: number | null }) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "range"]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query["maybeSingle"] = vi.fn().mockResolvedValue(result);
  query["then"] = (onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return query;
}

function makeSupabase(...results: Array<{ data: unknown; error: unknown; count?: number | null }>) {
  const queries = results.map(makeQuery);
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: VIEWER_ID } }, error: null }),
    },
    from: vi.fn().mockImplementation(() => {
      const query = queries.shift();
      if (!query) throw new Error("Unexpected query");
      return query;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.example.com/avatar.png" },
    error: null,
  });
  mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl });
  mockCreateServiceClient.mockReturnValue({
    storage: { from: mockStorageFrom },
  });
});

describe("OrgMemberPublicProfileService", () => {
  it("returns public org member profiles with signed uploaded avatars", async () => {
    const supabase = makeSupabase(
      { data: { user_id: VIEWER_ID }, error: null },
      { data: [{ user_id: USER_ID }], error: null },
      {
        data: [
          {
            id: USER_ID,
            email: "alice@example.com",
            first_name: "Alice",
            last_name: "Smith",
            avatar_url: "https://provider.example.com/avatar.png",
            avatar_path: `${USER_ID}/avatar.png`,
          },
        ],
        error: null,
      }
    );

    const result = await OrgMemberPublicProfileService.listProfiles(supabase as never, ORG_ID, [
      USER_ID,
    ]);

    expect(result.success).toBe(true);
    expect(result).toMatchObject({
      success: true,
      data: [
        {
          user_id: USER_ID,
          display_name: "Alice Smith",
          email: "alice@example.com",
          avatar_url: "https://signed.example.com/avatar.png",
          profile_href: `/dashboard/organization/users/members/${USER_ID}`,
        },
      ],
    });
    expect(mockStorageFrom).toHaveBeenCalledWith("user-avatars");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(`${USER_ID}/avatar.png`, 3600);
  });

  it("does not sign an avatar path outside the member's own folder", async () => {
    const supabase = makeSupabase(
      { data: { user_id: VIEWER_ID }, error: null },
      { data: [{ user_id: USER_ID }], error: null },
      {
        data: [
          {
            id: USER_ID,
            email: "alice@example.com",
            first_name: "Alice",
            last_name: "Smith",
            avatar_url: "https://provider.example.com/avatar.png",
            avatar_path: "other-user/avatar.png",
          },
        ],
        error: null,
      }
    );

    const result = await OrgMemberPublicProfileService.listProfiles(supabase as never, ORG_ID, [
      USER_ID,
    ]);

    expect(result.success).toBe(true);
    expect(
      (result as { success: true; data: Array<{ avatar_url: string | null }> }).data[0].avatar_url
    ).toBe("https://provider.example.com/avatar.png");
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("fails closed when the viewer is not an active member of the org", async () => {
    const supabase = makeSupabase({ data: null, error: null });

    const result = await OrgMemberPublicProfileService.listProfiles(supabase as never, ORG_ID, [
      USER_ID,
    ]);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns paginated public org member profiles and total counts", async () => {
    const secondUserId = "user-2";
    const supabase = makeSupabase(
      { data: { user_id: VIEWER_ID }, error: null },
      { data: [{ user_id: secondUserId }], error: null, count: 25 },
      {
        data: [
          {
            id: secondUserId,
            email: "bob@example.com",
            first_name: "Bob",
            last_name: "Jones",
            avatar_url: null,
            avatar_path: `${secondUserId}/avatar.png`,
          },
        ],
        error: null,
      }
    );

    const result = await OrgMemberPublicProfileService.listProfilesForOrgPage(
      supabase as never,
      ORG_ID,
      2,
      24
    );

    expect(result.success).toBe(true);
    expect(result).toMatchObject({
      success: true,
      data: {
        totalCount: 25,
        page: 2,
        pageSize: 24,
        totalPages: 2,
        rows: [
          {
            user_id: secondUserId,
            display_name: "Bob Jones",
            avatar_url: "https://signed.example.com/avatar.png",
          },
        ],
      },
    });
  });

  it("counts active public profiles after authorizing the viewer", async () => {
    const supabase = makeSupabase(
      { data: { user_id: VIEWER_ID }, error: null },
      { data: null, error: null, count: 42 }
    );

    const result = await OrgMemberPublicProfileService.countProfilesForOrg(
      supabase as never,
      ORG_ID
    );

    expect(result).toEqual({ success: true, data: 42 });
  });
});
