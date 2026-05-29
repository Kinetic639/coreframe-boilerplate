import { Mail, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import { UserAvatar, UserAvatarGroup } from "@/components/primitives/avatar";
import type { UserAvatarGroupItem } from "@/components/primitives/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { OrgMemberPublicProfileService } from "@/server/services/org-member-public-profile.service";
import type { OrgMemberPublicProfile } from "@/server/services/org-member-public-profile.service";

function fallbackFor(profile: OrgMemberPublicProfile): string {
  const initials = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .map((part) => part?.[0])
    .join("")
    .toUpperCase();

  return initials || profile.email?.[0]?.toUpperCase() || "U";
}

function toAvatarItem(profile: OrgMemberPublicProfile): UserAvatarGroupItem {
  return {
    id: profile.user_id,
    fullName: profile.display_name,
    fallback: fallbackFor(profile),
    email: profile.email,
    src: profile.avatar_url,
    profileHref: profile.profile_href,
  };
}

export default async function AdminOrgMembersPage() {
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <div className="border-b px-6 py-4">
          <h1 className="text-2xl font-bold tracking-tight">Organization Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No active organization is selected for this account.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const profilesResult = await OrgMemberPublicProfileService.listProfilesForOrg(
    supabase,
    context.app.activeOrgId
  );

  let profiles: OrgMemberPublicProfile[] = [];
  let profilesError: string | null = null;

  if (profilesResult.success) {
    profiles = [...profilesResult.data].sort((a, b) =>
      a.display_name.localeCompare(b.display_name)
    );
  } else {
    profilesError = (profilesResult as { success: false; error: string }).error;
  }

  const avatarItems = profiles.map(toAvatarItem);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <Badge variant="outline">Active organization</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Organization Members</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Live member profile data using the shared public org-member profile service.
            </p>
          </div>

          <Badge variant="secondary" className="gap-1">
            <UserRoundCheck className="h-3.5 w-3.5" />
            {profiles.length} active members
          </Badge>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
        {profilesError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {profilesError}
          </div>
        )}

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Avatar preview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hover avatars to inspect member details and open the profile preview target.
              </p>
            </div>

            {avatarItems.length > 0 && (
              <UserAvatarGroup users={avatarItems} max={8} size="default" />
            )}
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Members</h2>
            <span className="text-xs text-muted-foreground">
              Private uploaded avatars are signed server-side.
            </span>
          </div>

          {profiles.length === 0 ? (
            <div className="rounded-md border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No active members found.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {profiles.map((profile) => (
                <div
                  key={profile.user_id}
                  className="flex min-w-0 items-center gap-3 rounded-md border bg-muted/20 p-4"
                >
                  <UserAvatar
                    src={profile.avatar_url}
                    fullName={profile.display_name}
                    fallback={fallbackFor(profile)}
                    email={profile.email}
                    profileHref={profile.profile_href}
                    className="h-11 w-11"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold">{profile.display_name}</p>
                      <Badge variant="outline" className="shrink-0 gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        member
                      </Badge>
                    </div>
                    {profile.email && (
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{profile.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
