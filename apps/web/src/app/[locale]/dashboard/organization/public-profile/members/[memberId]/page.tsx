import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/primitives/avatar";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { OrganizationPublicProfileService } from "@/server/services/organization-public-profile.service";
import type { PublicMemberProfile } from "@/server/services/organization-public-profile.service";

type PageProps = {
  params: Promise<{ memberId: string }>;
};

function fallbackForMember(member: PublicMemberProfile): string {
  const initials = [member.first_name, member.last_name]
    .filter(Boolean)
    .map((part) => part?.[0])
    .join("")
    .toUpperCase();

  return initials || member.email?.[0]?.toUpperCase() || "U";
}

export default async function PublicMemberProfilePage({ params }: PageProps) {
  const locale = await getLocale();
  const { memberId } = await params;
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const t = await getTranslations("publicOrgProfile");
  const supabase = await createClient();
  const result = await OrganizationPublicProfileService.getMemberProfile(
    supabase,
    context.app.activeOrgId,
    memberId
  );

  if (!result.success) notFound();

  const member = result.data;

  return (
    <div className="space-y-6">
      <Link
        href={{
          pathname: "/dashboard/organization/public-profile/[tab]",
          params: { tab: "members" },
        }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("memberProfile.back")}
      </Link>

      <section className="overflow-hidden rounded-md border bg-muted/20">
        <div className="flex min-h-64 items-center justify-center bg-muted">
          {member.portrait_url ? (
            <Image
              src={member.portrait_url}
              alt={member.display_name}
              width={960}
              height={360}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserAvatar
              src={member.avatar_url}
              fullName={member.display_name}
              fallback={fallbackForMember(member)}
              email={member.email}
              disabledPopover
              className="h-28 w-28"
            />
          )}
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" />
                <Badge variant="outline">{t("memberProfile.badge")}</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{member.display_name}</h1>
              {member.email && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {member.email}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 max-w-3xl">
            <h2 className="text-base font-semibold">{t("memberProfile.about")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {member.bio || t("empty.memberBio")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
