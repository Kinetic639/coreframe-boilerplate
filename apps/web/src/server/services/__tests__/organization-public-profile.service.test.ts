/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationPublicProfileService } from "../organization-public-profile.service";
import { OrgMemberPublicProfileService } from "../org-member-public-profile.service";

vi.mock("../org-member-public-profile.service", () => ({
  OrgMemberPublicProfileService: {
    countProfilesForOrg: vi.fn(),
    listProfilesForOrg: vi.fn(),
    listProfilesForOrgPage: vi.fn(),
    getProfile: vi.fn(),
  },
}));

const ORG_ID = "org-1";
const USER_ID = "user-1";

function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order"]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query["maybeSingle"] = vi.fn().mockResolvedValue(result);
  query["then"] = (onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return query;
}

function makeSupabase(...results: Array<{ data: unknown; error: unknown }>) {
  const queries = results.map(makeQuery);
  return {
    from: vi.fn().mockImplementation(() => {
      const query = queries.shift();
      if (!query) throw new Error("Unexpected query");
      return query;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(OrgMemberPublicProfileService.countProfilesForOrg).mockResolvedValue({
    success: true,
    data: 1,
  });
  vi.mocked(OrgMemberPublicProfileService.listProfilesForOrg).mockResolvedValue({
    success: true,
    data: [
      {
        user_id: USER_ID,
        email: "worker@example.com",
        first_name: "Worker",
        last_name: "One",
        display_name: "Worker One",
        avatar_url: "https://example.com/avatar.png",
        profile_href: `/dashboard/organization/public-profile/members/${USER_ID}`,
      },
    ],
  });
  vi.mocked(OrgMemberPublicProfileService.listProfilesForOrgPage).mockResolvedValue({
    success: true,
    data: {
      rows: [
        {
          user_id: USER_ID,
          email: "worker@example.com",
          first_name: "Worker",
          last_name: "One",
          display_name: "Worker One",
          avatar_url: "https://example.com/avatar.png",
          profile_href: `/dashboard/organization/users/members/${USER_ID}`,
        },
      ],
      totalCount: 12,
      page: 2,
      pageSize: 6,
      totalPages: 2,
    },
  });
});

describe("OrganizationPublicProfileService", () => {
  it("returns the org profile, public branch shape, and member profiles", async () => {
    const supabase = makeSupabase(
      {
        data: {
          organization_id: ORG_ID,
          name: "Ambra Org",
          name_2: "Operations",
          slug: "ambra-org",
          bio: "Public org bio",
          website: "https://ambra.app",
          logo_url: "https://example.com/logo.png",
          theme_color: "#f59e0b",
          font_color: "#111827",
        },
        error: null,
      },
      {
        data: [
          {
            id: "branch-1",
            organization_id: ORG_ID,
            name: "Main Branch",
            slug: "main",
            public_warehouse_maps_enabled: true,
          },
        ],
        error: null,
      }
    );

    const result = await OrganizationPublicProfileService.getBundle(supabase as never, ORG_ID);

    expect(result.success).toBe(true);
    expect(result).toMatchObject({
      success: true,
      data: {
        organization: {
          organization_id: ORG_ID,
          name: "Ambra Org",
          bio: "Public org bio",
        },
        branches: [
          {
            id: "branch-1",
            name: "Main Branch",
            description: null,
            image_url: null,
            address: null,
          },
        ],
        members: [
          {
            user_id: USER_ID,
            display_name: "Worker One",
          },
        ],
      },
    });
  });

  it("returns failure when the organization profile is missing", async () => {
    const supabase = makeSupabase({ data: null, error: null });

    const result = await OrganizationPublicProfileService.getBundle(supabase as never, ORG_ID);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "Organization profile not found"
    );
    expect(OrgMemberPublicProfileService.listProfilesForOrg).not.toHaveBeenCalled();
  });

  it("returns paginated public member profiles", async () => {
    const result = await OrganizationPublicProfileService.listMembers(
      makeSupabase() as never,
      ORG_ID,
      2,
      6
    );

    expect(result.success).toBe(true);
    expect(result).toMatchObject({
      success: true,
      data: {
        totalCount: 12,
        page: 2,
        pageSize: 6,
        rows: [
          {
            user_id: USER_ID,
            display_name: "Worker One",
            profile_href: `/dashboard/organization/public-profile/members/${USER_ID}`,
          },
        ],
      },
    });
    expect(OrgMemberPublicProfileService.listProfilesForOrgPage).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      2,
      6
    );
  });
});
