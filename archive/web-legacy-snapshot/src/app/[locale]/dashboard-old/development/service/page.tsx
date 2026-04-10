import React from "react";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { ServiceRoleTest } from "@/components/debug/ServiceRoleTest";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.development.service" });
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

export default async function ServiceDebugPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Server className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold">Service Debug</h1>
          <Badge variant="outline" className="border-red-200 text-red-600">
            DEBUG TOOL
          </Badge>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard-old/development" className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dev Dashboard</span>
          </Link>
        </Button>
      </div>

      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-red-800">Service Role Testing</CardTitle>
          <CardDescription className="text-red-700">
            Test service role connections, database access with elevated privileges, and server-side
            authentication flows.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Role Test</CardTitle>
          <CardDescription>
            Test connections using the Supabase service role key to bypass RLS policies and access
            database directly with administrative privileges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceRoleTest />
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-800">⚠️ Security Warning</CardTitle>
          <CardDescription className="text-amber-700">
            Service role keys provide full database access and bypass all security policies. This
            tool should only be used in development environments for debugging purposes. Never
            expose service role keys in client-side code or production environments.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
