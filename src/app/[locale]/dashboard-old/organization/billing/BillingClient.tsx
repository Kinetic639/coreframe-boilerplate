"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  Package,
  Users,
  MapPin,
  GitBranch,
  Calendar,
  Shield,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useAppStore } from "@/lib/stores/app-store";
import { cn } from "@/lib/utils";

interface BillingClientProps {
  translations: Record<string, any>;
}

export default function BillingClient({ translations }: BillingClientProps) {
  const { activeOrgId } = useAppStore();
  const { data: subscription, isLoading } = useSubscription(activeOrgId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{translations.title}</h1>
          <p className="text-muted-foreground">{translations.description}</p>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900">{translations.noSubscription.title}</CardTitle>
            </div>
            <CardDescription className="text-amber-700">
              {translations.noSubscription.description}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const plan = subscription.plan;
  const displayName =
    typeof plan.display_name === "object" && plan.display_name !== null
      ? (plan.display_name as any).en || (plan.display_name as any).pl || plan.name
      : plan.name;

  const isFreePlan = plan.name === "free";
  const isDevelopment = subscription.is_development;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{translations.title}</h1>
        <p className="text-muted-foreground">{translations.description}</p>
      </div>

      {/* Current Plan Card */}
      <Card
        className={cn(
          "border-2",
          isFreePlan ? "border-blue-200 bg-blue-50" : "border-green-200 bg-green-50"
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard
                className={cn("h-6 w-6", isFreePlan ? "text-blue-600" : "text-green-600")}
              />
              <div>
                <CardTitle
                  className={cn("text-xl", isFreePlan ? "text-blue-900" : "text-green-900")}
                >
                  {translations.currentPlan.title}
                </CardTitle>
                <CardDescription className={cn(isFreePlan ? "text-blue-700" : "text-green-700")}>
                  {translations.currentPlan.subtitle}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={subscription.status === "active" ? "default" : "secondary"}
                className="text-xs"
              >
                {translations.status[subscription.status] || subscription.status}
              </Badge>
              {isDevelopment && (
                <Badge variant="outline" className="border-amber-300 text-xs text-amber-800">
                  {translations.developmentPlan}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{displayName}</h3>
                {!isFreePlan && (
                  <span className="text-lg font-bold">
                    ${(plan.price_monthly / 100).toFixed(0)}/{translations.perMonth}
                  </span>
                )}
              </div>

              {/* Billing Period */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {translations.billingPeriod}:{" "}
                  {new Date(subscription.current_period_start).toLocaleDateString()} -{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Plan Features Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {translations.planIncludes}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span>
                    {plan.enabled_modules.length} {translations.modules}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  <span>
                    {plan.enabled_contexts.length} {translations.contexts}
                  </span>
                </div>
                {plan.limits.max_users !== undefined && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {plan.limits.max_users === -1
                        ? translations.unlimited
                        : plan.limits.max_users}{" "}
                      {translations.users}
                    </span>
                  </div>
                )}
                {plan.limits.max_branches !== undefined && (
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {plan.limits.max_branches === -1
                        ? translations.unlimited
                        : plan.limits.max_branches}{" "}
                      {translations.branches}
                    </span>
                  </div>
                )}
                {plan.limits.max_products !== undefined && (
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {plan.limits.max_products === -1
                        ? translations.unlimited
                        : plan.limits.max_products}{" "}
                      {translations.products}
                    </span>
                  </div>
                )}
                {plan.limits.max_locations !== undefined && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {plan.limits.max_locations === -1
                        ? translations.unlimited
                        : plan.limits.max_locations}{" "}
                      {translations.locations}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Modules */}
      <Card>
        <CardHeader>
          <CardTitle>{translations.availableModules.title}</CardTitle>
          <CardDescription>{translations.availableModules.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {plan.enabled_modules.map((module) => (
              <div key={module} className="flex items-center gap-2 rounded-lg border p-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium capitalize">
                  {translations.moduleNames[module] || module.replace("-", " ")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Contexts */}
      <Card>
        <CardHeader>
          <CardTitle>{translations.availableContexts.title}</CardTitle>
          <CardDescription>{translations.availableContexts.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {plan.enabled_contexts.map((context) => (
              <div key={context} className="flex items-center gap-2 rounded-lg border p-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <span className="text-sm font-medium capitalize">
                    {translations.contextNames?.[context] || context}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {translations.contextDescriptions?.[context] ||
                      `${context.charAt(0).toUpperCase() + context.slice(1)} context`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
