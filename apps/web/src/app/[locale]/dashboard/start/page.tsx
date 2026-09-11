import { Suspense } from "react";
import { Building2, MapPin } from "lucide-react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { loadAttention, loadHomeContext, loadOpenTaskCount } from "./_lib/data";
import { homeCopy } from "./_lib/copy";
import { formatRefreshTime } from "./_lib/model";
import { HomeRefreshControl, HomeScopeBoundary } from "./_components/scope-boundary";
import { OverviewSkeleton, WidgetSkeleton } from "./_components/home-sections";
import { OperationalOverview } from "./_components/operational-overview";
import { AttentionWidget } from "./_components/attention-widget";
import { ActivityWidget } from "./_components/activity-widget";

export default async function DashboardStartPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string | string[] }>;
}) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const context = await loadHomeContext(
    typeof params.branch === "string" ? params.branch : undefined
  );
  if (!context) return redirect({ href: "/sign-in", locale });
  const copy = homeCopy(locale);
  const attentionResult =
    context.orgId && context.branchId && context.actions.includes("tickets")
      ? loadAttention(context.orgId, context.branchId)
      : null;
  const taskResult =
    context.orgId && context.branchId && context.actions.includes("tasks")
      ? loadOpenTaskCount(context.orgId, context.branchId)
      : null;
  const refreshedAt = formatRefreshTime(new Date().toISOString(), locale);
  return (
    <div className="w-full pb-6">
      <HomeScopeBoundary
        orgId={context.orgId}
        branchId={context.branchId}
        loadingLabel={copy.changingBranch}
      >
        <>
          <header className="relative overflow-hidden rounded-md border bg-muted/20">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
            <h1 className="sr-only">{copy.title}</h1>
            <dl className="grid gap-2.5 px-3 py-2.5 pl-4 sm:grid-cols-2 sm:items-center sm:gap-4 sm:px-4 sm:pl-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-3" />
                  {copy.branch}
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-base font-semibold tracking-tight">
                  <span data-testid="home-branch">{context.branchName ?? copy.noBranch}</span>
                  {context.branchId ? (
                    <Badge className="h-5 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
                      <span className="mr-1 size-1.5 rounded-full bg-current" />
                      {copy.active}
                    </Badge>
                  ) : null}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Building2 aria-hidden="true" className="size-3" />
                  {copy.organization}
                </dt>
                <dd className="mt-0.5 break-words text-sm font-medium">
                  {context.orgName ?? copy.noOrg}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2 sm:justify-self-end lg:col-span-1">
                <HomeRefreshControl
                  refreshLabel={copy.refresh}
                  refreshedAtLabel={
                    refreshedAt ? copy.refreshedAt.replace("{time}", refreshedAt) : null
                  }
                />
              </div>
            </dl>
          </header>
          {!context.orgId || !context.branchId ? (
            <p className="text-sm text-foreground/80">{copy.noContext}</p>
          ) : null}
          <Suspense fallback={<OverviewSkeleton label={copy.loading} />}>
            <OperationalOverview
              actions={context.actions}
              copy={copy}
              attentionResult={attentionResult}
              taskResult={taskResult}
            />
          </Suspense>
          {context.orgId ? (
            <div
              className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
              key={`${context.orgId}:${context.branchId}`}
            >
              {context.actions.includes("tickets") && context.branchId ? (
                <Suspense fallback={<WidgetSkeleton label={copy.loading} />}>
                  <AttentionWidget
                    orgId={context.orgId}
                    branchId={context.branchId}
                    locale={locale}
                    copy={copy}
                    resultPromise={attentionResult ?? undefined}
                  />
                </Suspense>
              ) : null}
              <Suspense fallback={<WidgetSkeleton label={copy.loading} />}>
                <ActivityWidget branchId={context.branchId} locale={locale} copy={copy} />
              </Suspense>
            </div>
          ) : null}
        </>
      </HomeScopeBoundary>
    </div>
  );
}
