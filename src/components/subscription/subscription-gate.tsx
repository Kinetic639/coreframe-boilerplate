"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Lock, Zap, Crown, ArrowRight, Loader2 } from "lucide-react";
import {
  useSubscription,
  useModuleAccess,
  useFeatureAccess,
  useUsageLimit,
} from "@/hooks/use-subscription";
import { useAppStore } from "@/lib/stores/app-store";
import { cn } from "@/lib/utils";

interface SubscriptionGateProps {
  children: React.ReactNode;
  module?: string;
  feature?: string;
  usageLimit?: string;
  showUpgradePrompt?: boolean;
  upgradeMessage?: string;
  fallback?: React.ReactNode;
  className?: string;
  minimalist?: boolean; // For inline gates
}

export function SubscriptionGate({
  children,
  module,
  feature,
  usageLimit,
  showUpgradePrompt = true,
  upgradeMessage,
  fallback,
  className,
  minimalist = false,
}: SubscriptionGateProps) {
  const { activeOrgId } = useAppStore();

  const { data: subscription, isLoading: subscriptionLoading } = useSubscription(activeOrgId);
  const { data: moduleAccess, isLoading: moduleLoading } = useModuleAccess(
    module || "",
    activeOrgId
  );
  const { data: featureAccess, isLoading: featureLoading } = useFeatureAccess(
    feature || "",
    activeOrgId
  );
  const { data: usageLimitData, isLoading: usageLoading } = useUsageLimit(
    usageLimit || "",
    activeOrgId
  );

  const isLoading = subscriptionLoading || moduleLoading || featureLoading || usageLoading;

  // Determine access
  const hasAccess = React.useMemo(() => {
    if (isLoading) return null; // Still loading

    // Check module access
    if (module && moduleAccess === false) return false;

    // Check feature access
    if (feature && featureAccess === false) return false;

    // Check usage limits
    if (usageLimit && usageLimitData && !usageLimitData.canProceed) return false;

    return true;
  }, [isLoading, module, moduleAccess, feature, featureAccess, usageLimit, usageLimitData]);

  // Loading state
  if (isLoading || hasAccess === null) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  // Has access - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // No access - render fallback or upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  // Determine the reason for blocking and appropriate upgrade message
  const blockReason = getBlockReason(
    module,
    moduleAccess,
    feature,
    featureAccess,
    usageLimit,
    usageLimitData
  );

  if (minimalist) {
    return (
      <div
        className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}
      >
        <Lock className="h-3 w-3" />
        <span>{blockReason.title}</span>
        <Button variant="link" size="sm" className="h-auto p-0">
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <UpgradePrompt
        currentPlan={subscription?.plan.name}
        reason={blockReason}
        customMessage={upgradeMessage}
      />
    </div>
  );
}

interface UpgradePromptProps {
  currentPlan?: string;
  reason: BlockReason;
  customMessage?: string;
}

function UpgradePrompt({ currentPlan, reason, customMessage }: UpgradePromptProps) {
  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          {reason.icon}
          <div className="flex-1">
            <CardTitle className="text-lg text-amber-900">{reason.title}</CardTitle>
            <CardDescription className="text-amber-700">
              {customMessage || reason.description}
            </CardDescription>
          </div>
          {currentPlan && (
            <Badge variant="outline" className="border-amber-300 text-amber-800">
              {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-amber-900">{reason.ctaText}</p>
            {reason.features && (
              <ul className="space-y-1 text-xs text-amber-700">
                {reason.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button className="bg-amber-600 text-white hover:bg-amber-700">
            Upgrade Plan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Usage limit specific component
interface UsageLimitGateProps {
  children: React.ReactNode;
  limitKey: string;
  showWarningAt?: number; // Show warning when usage reaches this percentage (0-1)
  warningMessage?: string;
  className?: string;
}

export function UsageLimitGate({
  children,
  limitKey,
  showWarningAt = 0.8,
  warningMessage,
  className,
}: UsageLimitGateProps) {
  const { activeOrgId } = useAppStore();
  const { data: usageData, isLoading } = useUsageLimit(limitKey, activeOrgId);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (!usageData) return <>{children}</>;

  const usagePercent = usageData.limit > 0 ? usageData.current / usageData.limit : 0;
  const showWarning = usagePercent >= showWarningAt && usageData.limit !== -1;
  const isAtLimit = usageData.isAtLimit;

  if (isAtLimit) {
    return (
      <div className={className}>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900">Usage Limit Reached</CardTitle>
            </div>
            <CardDescription className="text-red-700">
              You've reached your {limitKey.replace("_", " ")} limit of {usageData.limit}. Upgrade
              your plan to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive">Upgrade Plan</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      {showWarning && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                {warningMessage ||
                  `You're using ${usageData.current} of ${usageData.limit} ${limitKey.replace("_", " ")}. Consider upgrading before you hit the limit.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {children}
    </div>
  );
}

// Feature flag component (different from gate - just shows/hides based on feature)
interface FeatureFlagProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureFlag({ feature, children, fallback }: FeatureFlagProps) {
  const { activeOrgId } = useAppStore();
  const { data: hasFeature, isLoading } = useFeatureAccess(feature, activeOrgId);

  if (isLoading) return <Skeleton className="h-4 w-full" />;
  if (!hasFeature) return fallback ? <>{fallback}</> : null;

  return <>{children}</>;
}

// Loading gate component
interface LoadingGateProps {
  children: React.ReactNode;
  isLoading: boolean;
  loadingText?: string;
}

export function LoadingGate({ children, isLoading, loadingText = "Loading..." }: LoadingGateProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">{loadingText}</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Helper types and functions
interface BlockReason {
  title: string;
  description: string;
  ctaText: string;
  icon: React.ReactNode;
  features?: string[];
}

function getBlockReason(
  module?: string,
  moduleAccess?: boolean,
  feature?: string,
  featureAccess?: boolean,
  usageLimit?: string,
  usageLimitData?: any
): BlockReason {
  // Usage limit exceeded
  if (usageLimit && usageLimitData && !usageLimitData.canProceed) {
    return {
      title: "Usage Limit Reached",
      description: `You've reached your ${usageLimit.replace("_", " ")} limit of ${usageLimitData.limit}.`,
      ctaText: "Upgrade to continue",
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
      features: ["Higher limits", "Unlimited usage on enterprise plans"],
    };
  }

  // Feature access denied
  if (feature && featureAccess === false) {
    return {
      title: "Premium Feature",
      description: `This feature requires a higher subscription plan.`,
      ctaText: "Unlock advanced features",
      icon: <Crown className="h-5 w-5 text-amber-600" />,
      features: ["Advanced reporting", "Priority support", "Custom branding"],
    };
  }

  // Module access denied
  if (module && moduleAccess === false) {
    return {
      title: "Module Unavailable",
      description: `The ${module} module is not included in your current plan.`,
      ctaText: "Access more modules",
      icon: <Lock className="h-5 w-5 text-amber-600" />,
      features: [`${module} module`, "Additional integrations", "Enhanced functionality"],
    };
  }

  // Default
  return {
    title: "Upgrade Required",
    description: "This feature is not available on your current plan.",
    ctaText: "Upgrade your subscription",
    icon: <Zap className="h-5 w-5 text-amber-600" />,
  };
}
