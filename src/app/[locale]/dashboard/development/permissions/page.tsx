import React from "react";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import PermissionDebug from "@/components/debug/PermissionDebug";
import { PermissionTestComponent } from "@/components/debug/PermissionTestComponent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.development.permissions" });
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

export default async function PermissionsDebugPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Permissions Debug</h1>
          <Badge variant="outline" className="border-blue-200 text-blue-600">
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

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-blue-800">Permissions Testing</CardTitle>
          <CardDescription className="text-blue-700">
            Test user permissions, roles, JWT tokens, and authorization flows. Use these tools to
            debug permission-related issues.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Permission Test Component</CardTitle>
            <CardDescription>
              Comprehensive testing tool for backend permissions, app context, user context, and JWT
              tokens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PermissionTestComponent />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permission Debug Info</CardTitle>
            <CardDescription>
              Display current user permissions, roles, and authorization status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PermissionDebug />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
