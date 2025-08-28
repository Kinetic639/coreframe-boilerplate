import React from "react";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, ArrowLeft, User, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.development.context" });
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

export default async function ContextDebugPage() {
  const appContext = await loadAppContextServer();
  const userContext = await loadUserContextServer();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl font-bold">Context Debug</h1>
          <Badge variant="outline" className="border-green-200 text-green-600">
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

      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-green-800">Context Debugging</CardTitle>
          <CardDescription className="text-green-700">
            View and debug application context, user context, and Zustand store states. This shows
            the server-side loaded data.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-500" />
              <CardTitle>User Context</CardTitle>
              <Badge variant={userContext ? "default" : "destructive"}>
                {userContext ? "Loaded" : "Failed"}
              </Badge>
            </div>
            <CardDescription>
              User authentication, preferences, roles, and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(userContext, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Building className="h-5 w-5 text-purple-500" />
              <CardTitle>App Context</CardTitle>
              <Badge variant={appContext ? "default" : "destructive"}>
                {appContext ? "Loaded" : "Failed"}
              </Badge>
            </div>
            <CardDescription>Organization, branches, modules, and application data</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(appContext, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      {appContext && userContext && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">Context Status Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">User</p>
                <p className="text-lg font-semibold">{userContext.user.email}</p>
                <p className="text-sm text-gray-500">{userContext.roles.length} roles</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Organization</p>
                <p className="text-lg font-semibold">
                  {appContext.activeOrg?.name || "No Active Org"}
                </p>
                <p className="text-sm text-gray-500">
                  {appContext.availableBranches.length} branches
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Modules</p>
                <p className="text-lg font-semibold">{appContext.userModules.length}</p>
                <p className="text-sm text-gray-500">
                  {userContext.permissions.length} permissions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
