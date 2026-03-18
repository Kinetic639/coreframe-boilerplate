import React from "react";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Shield, Database, Image, Server, Code, AlertTriangle, CreditCard } from "lucide-react";
import { DevelopmentSubscriptionManager } from "@/components/dev/subscription-manager";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.development.dashboard" });
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

const debugTools = [
  {
    id: "permissions",
    title: "Permissions Debug",
    description: "Test and debug user permissions, roles, and authorization",
    icon: Shield,
    href: "/dashboard-old/development/permissions",
    status: "ready" as const,
  },
  {
    id: "context",
    title: "Context Debug",
    description: "Debug app context, user context, and Zustand stores",
    icon: Database,
    href: "/dashboard-old/development/context",
    status: "ready" as const,
  },
  {
    id: "logo",
    title: "Logo Debug",
    description: "Debug organization logo uploads and storage",
    icon: Image,
    href: "/dashboard-old/development/logo",
    status: "ready" as const,
  },
  {
    id: "service",
    title: "Service Debug",
    description: "Test service role connections and database access",
    icon: Server,
    href: "/dashboard-old/development/service",
    status: "ready" as const,
  },
  {
    id: "subscription-test",
    title: "Subscription Test",
    description: "Test subscription system, access controls, and plan switching",
    icon: CreditCard,
    href: "/dashboard-old/dev/subscription-test",
    status: "ready" as const,
  },
];

export default async function DevelopmentDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Code className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Development Dashboard</h1>
        <Badge variant="outline" className="border-amber-200 text-amber-600">
          DEV TOOLS
        </Badge>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-800">Development Environment</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700">
            This module contains development tools and debugging utilities. These tools should only
            be available in development environments.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {debugTools.map((tool) => {
          const IconComponent = tool.icon;
          return (
            <Card key={tool.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5 text-gray-600" />
                    <CardTitle className="text-lg">{tool.title}</CardTitle>
                  </div>
                  <Badge
                    variant={tool.status === "ready" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {tool.status}
                  </Badge>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={tool.href}>Open Tool</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Development Subscription Manager Widget */}
      <DevelopmentSubscriptionManager position="relative" />
    </div>
  );
}
