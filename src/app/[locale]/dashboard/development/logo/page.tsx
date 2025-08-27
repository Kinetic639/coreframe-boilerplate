import React from "react";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import LogoDebug from "@/components/debug/LogoDebug";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.development.logo" });
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

export default async function LogoDebugPage() {
  const appContext = await loadAppContextServer();
  const locale = await getLocale();

  if (!appContext?.activeOrg) {
    return redirect({ href: "/dashboard/development", locale });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Image className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Logo Debug</h1>
          <Badge variant="outline" className="border-orange-200 text-orange-600">
            DEBUG TOOL
          </Badge>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/development" className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dev Dashboard</span>
          </Link>
        </Button>
      </div>

      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-orange-800">Logo Storage Debug</CardTitle>
          <CardDescription className="text-orange-700">
            Debug organization logo uploads, storage access, and URL generation. Test file
            permissions and storage bucket configurations.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            <CardTitle>Organization Info</CardTitle>
          </div>
          <CardDescription>
            Current organization: <strong>{appContext.activeOrg.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Organization ID:</strong> {appContext.activeOrg.organization_id}
            </p>
            <p>
              <strong>Current Logo URL:</strong> {appContext.activeOrg.logo_url || "None"}
            </p>
            <p>
              <strong>Slug:</strong> {appContext.activeOrg.slug}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo Debug Tool</CardTitle>
          <CardDescription>
            Test logo upload, access permissions, and storage functionality.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoDebug
            organizationId={appContext.activeOrg.organization_id}
            currentLogoUrl={appContext.activeOrg.logo_url}
          />
        </CardContent>
      </Card>
    </div>
  );
}
