import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { AvatarPreview, UserAvatar } from "@/components/primitives/avatar";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { OrganizationPublicProfileService } from "@/server/services/organization-public-profile.service";
import type { PublicMemberProfile } from "@/server/services/organization-public-profile.service";
import { formatDate } from "@/lib/date-time/format";

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
  const showFullName = Boolean(member.full_name && member.full_name !== member.display_name);
  const details = [
    member.job_title
      ? { icon: Briefcase, label: t("memberProfile.position"), value: member.job_title }
      : null,
    member.branch_name
      ? { icon: Building2, label: t("memberProfile.branch"), value: member.branch_name }
      : null,
    member.email
      ? {
          icon: Mail,
          label: t("memberProfile.email"),
          value: member.email,
          href: `mailto:${member.email}`,
        }
      : null,
    member.phone
      ? {
          icon: Phone,
          label: t("memberProfile.phone"),
          value: member.phone,
          href: `tel:${member.phone.replace(/\s+/g, "")}`,
        }
      : null,
    member.joined_at
      ? {
          icon: CalendarDays,
          label: t("memberProfile.memberSince"),
          value: formatDate(member.joined_at, locale, { dateStyle: "long" }),
        }
      : null,
  ].filter(Boolean) as Array<{
    icon: typeof Mail;
    label: string;
    value: string;
    href?: string;
  }>;

  return (
    <div className="min-w-0 space-y-6">
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
        <div className="flex min-h-48 items-center justify-center bg-muted sm:min-h-64">
          {member.portrait_url ? (
            <Image
              src={member.portrait_url}
              alt={member.display_name}
              width={960}
              height={360}
              className="h-full w-full object-cover"
            />
          ) : (
            <AvatarPreview
              src={member.avatar_url}
              name={member.display_name}
              label={t("memberProfile.showPhoto")}
            >
              <UserAvatar
                src={member.avatar_url}
                fullName={member.display_name}
                fallback={fallbackForMember(member)}
                email={member.email}
                disabledPopover
                className="h-28 w-28"
                fallbackClassName="text-2xl"
              />
            </AvatarPreview>
          )}
        </div>

        <div className="p-4 sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <UserRound className="h-5 w-5 shrink-0 text-primary" />
              <Badge variant="outline">{t("memberProfile.badge")}</Badge>
            </div>
            <h1
              className="break-words text-2xl font-bold tracking-tight [overflow-wrap:anywhere]"
              title={member.display_name}
            >
              {member.display_name}
            </h1>
            {showFullName && (
              <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {member.full_name}
              </p>
            )}
          </div>

          {details.length > 0 && (
            <div className="mt-6 max-w-3xl">
              <h2 className="text-base font-semibold">{t("memberProfile.details")}</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {details.map((item) => (
                  <div key={item.label} className="flex min-w-0 items-start gap-3">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{item.label}</dt>
                      <dd className="truncate text-sm" title={item.value}>
                        {item.href ? (
                          <a href={item.href} className="hover:underline">
                            {item.value}
                          </a>
                        ) : (
                          item.value
                        )}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-6 max-w-3xl">
            <h2 className="text-base font-semibold">{t("memberProfile.about")}</h2>
            <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
              {member.bio || t("empty.memberBio")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
