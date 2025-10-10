import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  Settings,
  Users,
  Warehouse,
  FileText,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import type { Pathnames } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.dashboard.start.gettingStarted" });
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
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

async function GettingStartedContent() {
  const t = await getTranslations("pages.start.gettingStarted");

  const steps: Array<{
    title: string;
    description: string;
    icon: typeof Settings;
    href: Pathnames;
    color: string;
    completed: boolean;
  }> = [
    {
      title: t("steps.configureOrganization.title"),
      description: t("steps.configureOrganization.description"),
      icon: Settings,
      href: "/dashboard/organization",
      color: "text-blue-500",
      completed: false,
    },
    {
      title: t("steps.inviteTeam.title"),
      description: t("steps.inviteTeam.description"),
      icon: Users,
      href: "/dashboard/teams",
      color: "text-purple-500",
      completed: false,
    },
    {
      title: t("steps.setupWarehouse.title"),
      description: t("steps.setupWarehouse.description"),
      icon: Warehouse,
      href: "/dashboard/warehouse/locations",
      color: "text-green-500",
      completed: false,
    },
    {
      title: t("steps.addProducts.title"),
      description: t("steps.addProducts.description"),
      icon: FileText,
      href: "/dashboard/warehouse/products",
      color: "text-orange-500",
      completed: false,
    },
    {
      title: t("steps.configureSettings.title"),
      description: t("steps.configureSettings.description"),
      icon: Settings,
      href: "/dashboard/warehouse/settings",
      color: "text-indigo-500",
      completed: false,
    },
    {
      title: t("steps.getHelp.title"),
      description: t("steps.getHelp.description"),
      icon: HelpCircle,
      href: "/dashboard/support",
      color: "text-pink-500",
      completed: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("welcomeTitle")}</h2>
        <p className="text-muted-foreground">{t("welcomeDescription")}</p>
      </div>

      {/* Progress indicator */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t("progressTitle")}
          </CardTitle>
          <CardDescription>{t("progressDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-2 w-0 rounded-full bg-primary transition-all" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">0%</span>
          </div>
        </CardContent>
      </Card>

      {/* Steps grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card key={step.title} className="group transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-muted`}
                    >
                      <Icon className={`h-5 w-5 ${step.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {index + 1}. {step.title}
                      </CardTitle>
                    </div>
                  </div>
                  {step.completed && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">{step.description}</p>
                <Link href={step.href as any}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    {t("startButton")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help section */}
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            {t("needHelp.title")}
          </CardTitle>
          <CardDescription>{t("needHelp.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/dashboard/support">
            <Button variant="outline">{t("needHelp.contactSupport")}</Button>
          </Link>
          <Link href="/dashboard/support">
            <Button variant="outline">{t("needHelp.viewDocs")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GettingStartedPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <GettingStartedContent />
    </Suspense>
  );
}
