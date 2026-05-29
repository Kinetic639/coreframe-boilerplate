import Image from "next/image";
import { notFound } from "next/navigation";
import { Building2, ExternalLink, Globe2, Mail, MapPin, Phone, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/primitives/avatar";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { OrganizationPublicProfileService } from "@/server/services/organization-public-profile.service";
import type {
  PaginatedPublicMemberProfiles,
  PublicBranchProfile,
  PublicMemberProfile,
  PublicOrganizationProfile,
} from "@/server/services/organization-public-profile.service";

type PublicProfileTab = "organization" | "branches" | "members";
const MEMBERS_PAGE_SIZE = 24;

type PageProps = {
  params: Promise<{ tab: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveTab(value: string): PublicProfileTab | null {
  if (value === "organization" || value === "branches" || value === "members") return value;
  return null;
}

function resolvePage(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const page = Number(rawValue);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function fallbackForMember(member: PublicMemberProfile): string {
  const initials = [member.first_name, member.last_name]
    .filter(Boolean)
    .map((part) => part?.[0])
    .join("")
    .toUpperCase();

  return initials || member.email?.[0]?.toUpperCase() || "U";
}

function OrgLogo({ organization }: { organization: PublicOrganizationProfile }) {
  if (organization.logo_url) {
    return (
      <Image
        src={organization.logo_url}
        alt={organization.name}
        width={96}
        height={96}
        className="size-24 rounded-md object-cover"
      />
    );
  }

  return (
    <div className="flex size-24 items-center justify-center rounded-md bg-muted">
      <Building2 className="size-10 text-muted-foreground" />
    </div>
  );
}

function BranchImage({ branch, large = false }: { branch: PublicBranchProfile; large?: boolean }) {
  if (branch.image_url) {
    return (
      <Image
        src={branch.image_url}
        alt={branch.name}
        width={large ? 420 : 280}
        height={large ? 260 : 180}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full min-h-40 w-full items-center justify-center bg-muted">
      <Building2 className="size-10 text-muted-foreground" />
    </div>
  );
}

function TabLink({
  tab,
  activeTab,
  children,
}: {
  tab: PublicProfileTab;
  activeTab: PublicProfileTab;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={{
        pathname: "/dashboard/organization/public-profile/[tab]",
        params: { tab },
      }}
      className={
        activeTab === tab
          ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

function OrganizationTab({
  organization,
  t,
}: {
  organization: PublicOrganizationProfile;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="rounded-md border bg-muted/20 p-5">
        <OrgLogo organization={organization} />
        <div className="mt-4 space-y-1">
          <h2 className="text-xl font-semibold">{organization.name}</h2>
          {organization.name_2 && (
            <p className="text-sm text-muted-foreground">{organization.name_2}</p>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-muted/20 p-5">
        <h3 className="text-base font-semibold">{t("organization.publicInformation")}</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {organization.bio || t("empty.description")}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {organization.website && (
            <a
              href={organization.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              <Globe2 className="h-4 w-4" />
              {organization.website}
            </a>
          )}
          {organization.slug && (
            <Badge variant="outline" className="px-3 py-1">
              {organization.slug}
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}

function BranchesTab({
  branches,
  t,
}: {
  branches: PublicBranchProfile[];
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (branches.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        {t("empty.branches")}
      </div>
    );
  }

  const [featuredBranch, ...otherBranches] = branches;

  return (
    <section className="space-y-5">
      <article className="grid overflow-hidden rounded-md border bg-muted/20 md:grid-cols-[320px_1fr]">
        <div className="min-h-56">
          <BranchImage branch={featuredBranch} large />
        </div>
        <div className="flex min-w-0 flex-col justify-center p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{featuredBranch.name}</h2>
            {featuredBranch.public_warehouse_maps_enabled && (
              <Badge variant="secondary">{t("branches.publicMap")}</Badge>
            )}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {featuredBranch.description || t("empty.branchDescription")}
          </p>
          <BranchContact branch={featuredBranch} />
        </div>
      </article>

      {otherBranches.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {otherBranches.map((branch) => (
            <article key={branch.id} className="overflow-hidden rounded-md border bg-muted/20">
              <div className="h-40">
                <BranchImage branch={branch} />
              </div>
              <div className="p-4">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <h3 className="truncate font-semibold">{branch.name}</h3>
                  {branch.public_warehouse_maps_enabled && (
                    <Badge variant="secondary">{t("branches.publicMapShort")}</Badge>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {branch.description || t("empty.branchDescription")}
                </p>
                <BranchContact branch={branch} compact />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function BranchContact({
  branch,
  compact = false,
}: {
  branch: PublicBranchProfile;
  compact?: boolean;
}) {
  const items = [
    branch.address ? { icon: MapPin, value: branch.address } : null,
    branch.phone ? { icon: Phone, value: branch.phone } : null,
    branch.email ? { icon: Mail, value: branch.email } : null,
    branch.website ? { icon: Globe2, value: branch.website } : null,
  ].filter(Boolean) as Array<{ icon: typeof MapPin; value: string }>;

  if (items.length === 0) return null;

  return (
    <div className={compact ? "mt-3 space-y-1" : "mt-5 grid gap-2 sm:grid-cols-2"}>
      {items.map((item) => (
        <div
          key={item.value}
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function MembersTab({
  membersPage,
  t,
}: {
  membersPage: PaginatedPublicMemberProfiles;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const members = membersPage.rows;

  if (members.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        {t("empty.members")}
      </div>
    );
  }

  const firstVisible = (membersPage.page - 1) * membersPage.pageSize + 1;
  const lastVisible = Math.min(membersPage.page * membersPage.pageSize, membersPage.totalCount);
  const hasPrevious = membersPage.page > 1;
  const hasNext = membersPage.page < membersPage.totalPages;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <Link
            key={member.user_id}
            href={{
              pathname: "/dashboard/organization/public-profile/members/[memberId]",
              params: { memberId: member.user_id },
            }}
            className="group overflow-hidden rounded-md border bg-muted/20 transition-colors hover:bg-muted/40"
          >
            <div className="flex min-h-40 items-center justify-center bg-muted">
              {member.portrait_url ? (
                <Image
                  src={member.portrait_url}
                  alt={member.display_name}
                  width={420}
                  height={260}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserAvatar
                  src={member.avatar_url}
                  fullName={member.display_name}
                  fallback={fallbackForMember(member)}
                  email={member.email}
                  disabledPopover
                  className="h-20 w-20"
                />
              )}
            </div>
            <div className="p-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <h3 className="truncate font-semibold">{member.display_name}</h3>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              {member.email && (
                <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
              )}
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {member.bio || t("empty.memberBio")}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
        <span>
          {t("members.showing", {
            from: firstVisible,
            to: lastVisible,
            count: membersPage.totalCount,
          })}
        </span>
        <div className="flex items-center gap-2">
          {hasPrevious ? (
            <Link
              href={{
                pathname: "/dashboard/organization/public-profile/[tab]",
                params: { tab: "members" },
                query: { page: String(membersPage.page - 1) },
              }}
              className="rounded-md border px-3 py-2 font-medium text-foreground hover:bg-muted"
            >
              {t("members.previous")}
            </Link>
          ) : (
            <span className="rounded-md border px-3 py-2 font-medium opacity-50">
              {t("members.previous")}
            </span>
          )}
          {hasNext ? (
            <Link
              href={{
                pathname: "/dashboard/organization/public-profile/[tab]",
                params: { tab: "members" },
                query: { page: String(membersPage.page + 1) },
              }}
              className="rounded-md border px-3 py-2 font-medium text-foreground hover:bg-muted"
            >
              {t("members.next")}
            </Link>
          ) : (
            <span className="rounded-md border px-3 py-2 font-medium opacity-50">
              {t("members.next")}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export default async function OrganizationPublicProfilePage({ params, searchParams }: PageProps) {
  const locale = await getLocale();
  const { tab } = await params;
  const resolvedSearchParams = await searchParams;
  const activeTab = resolveTab(tab);
  if (!activeTab) notFound();

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const t = await getTranslations("publicOrgProfile");

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const [organizationResult, memberCountResult] = await Promise.all([
    OrganizationPublicProfileService.getOrganization(supabase, orgId),
    OrganizationPublicProfileService.countMembers(supabase, orgId),
  ]);

  if (!organizationResult.success || !memberCountResult.success) notFound();

  const organization = organizationResult.data;
  const memberCount = memberCountResult.data;
  let branches: PublicBranchProfile[] = [];
  let membersPage: PaginatedPublicMemberProfiles | null = null;

  if (activeTab === "branches") {
    const branchesResult = await OrganizationPublicProfileService.listBranches(supabase, orgId);
    if (!branchesResult.success) notFound();
    branches = branchesResult.data;
  }

  if (activeTab === "members") {
    const page = resolvePage(resolvedSearchParams.page);
    const membersResult = await OrganizationPublicProfileService.listMembers(
      supabase,
      orgId,
      page,
      MEMBERS_PAGE_SIZE
    );
    if (!membersResult.success) notFound();
    membersPage = membersResult.data;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <Badge variant="outline">{t("badge")}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{organization.name}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="secondary">{t("memberCount", { count: memberCount })}</Badge>
      </div>

      <nav className="flex flex-wrap gap-2 rounded-md border bg-muted/20 p-2">
        <TabLink tab="organization" activeTab={activeTab}>
          {t("tabs.organization")}
        </TabLink>
        <TabLink tab="branches" activeTab={activeTab}>
          {t("tabs.branches")}
        </TabLink>
        <TabLink tab="members" activeTab={activeTab}>
          {t("tabs.members")}
        </TabLink>
      </nav>

      {activeTab === "organization" && <OrganizationTab organization={organization} t={t} />}
      {activeTab === "branches" && <BranchesTab branches={branches} t={t} />}
      {activeTab === "members" && membersPage && <MembersTab membersPage={membersPage} t={t} />}
    </div>
  );
}
