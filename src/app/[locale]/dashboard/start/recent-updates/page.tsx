import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Bug, Wrench, FileText, Rocket, Calendar } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.dashboard.start.recentUpdates" });
  const common = await getTranslations({ locale, namespace: "metadata.common" });

  return {
    title: `${t("title")}${common("separator")}${common("appName")}`,
    description: t("description"),
    robots: {
      index: false,
      follow: false,
    },
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

async function RecentUpdatesContent() {
  const t = await getTranslations("pages.start.recentUpdates");

  const updates = [
    {
      title: t("updates.warehouseAudits.title"),
      description: t("updates.warehouseAudits.description"),
      type: "feature" as const,
      date: "2025-10-08",
      icon: Sparkles,
    },
    {
      title: t("updates.labelGenerator.title"),
      description: t("updates.labelGenerator.description"),
      type: "feature" as const,
      date: "2025-10-05",
      icon: FileText,
    },
    {
      title: t("updates.inventoryCorrections.title"),
      description: t("updates.inventoryCorrections.description"),
      type: "improvement" as const,
      date: "2025-10-01",
      icon: Wrench,
    },
    {
      title: t("updates.performanceOptimization.title"),
      description: t("updates.performanceOptimization.description"),
      type: "improvement" as const,
      date: "2025-09-28",
      icon: Rocket,
    },
    {
      title: t("updates.bugFixes.title"),
      description: t("updates.bugFixes.description"),
      type: "bugfix" as const,
      date: "2025-09-25",
      icon: Bug,
    },
  ];

  const getTypeConfig = (type: "feature" | "improvement" | "bugfix") => {
    switch (type) {
      case "feature":
        return {
          label: t("types.feature"),
          variant: "default" as const,
          color: "text-blue-500",
        };
      case "improvement":
        return {
          label: t("types.improvement"),
          variant: "secondary" as const,
          color: "text-green-500",
        };
      case "bugfix":
        return {
          label: t("types.bugfix"),
          variant: "destructive" as const,
          color: "text-red-500",
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4 border-l-2 border-muted pl-6">
        {updates.map((update, index) => {
          const Icon = update.icon;
          const typeConfig = getTypeConfig(update.type);

          return (
            <div key={index} className="relative">
              {/* Timeline dot */}
              <div
                className={`absolute -left-[29px] flex h-8 w-8 items-center justify-center rounded-full border-4 border-background bg-muted`}
              >
                <Icon className={`h-4 w-4 ${typeConfig.color}`} />
              </div>

              <Card className="transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(update.date)}
                        </div>
                      </div>
                      <CardTitle className="text-lg">{update.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{update.description}</CardDescription>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Footer message */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">
            {t("footer.moreUpdates")}{" "}
            <Link
              href="/dashboard/support/announcements/changelog"
              className="font-medium text-primary hover:underline"
            >
              {t("footer.viewChangelog")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RecentUpdatesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <RecentUpdatesContent />
    </Suspense>
  );
}
