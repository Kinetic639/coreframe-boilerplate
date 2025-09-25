"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, AlertTriangle, Settings } from "lucide-react";
import {
  useSubscription,
  useModuleAccess,
  useFeatureAccess,
  useUsageLimit,
} from "@/lib/hooks/use-subscription";
import { SubscriptionGate, FeatureFlag } from "@/components/subscription/subscription-gate";
import { useAppStore } from "@/lib/stores/app-store";
import { subscriptionService } from "@/lib/services/subscription-service";
import { toast } from "react-toastify";

interface SubscriptionTestProps {
  className?: string;
}

export function SubscriptionTest({ className }: SubscriptionTestProps) {
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Subscription System Test
          </CardTitle>
          <CardDescription>Testing subscription access controls and components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SubscriptionStatusTest />
          <ModuleAccessTest />
          <FeatureAccessTest />
          <UsageLimitsTest />
          <SubscriptionGateTests />
          <ActionTests />
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionStatusTest() {
  const { activeOrgId } = useAppStore();
  const { data: subscription, isLoading } = useSubscription(activeOrgId);

  return (
    <div>
      <h4 className="mb-2 font-medium">Subscription Status</h4>
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : subscription ? (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {typeof subscription.plan.display_name === "object" &&
              subscription.plan.display_name !== null
                ? (subscription.plan.display_name as any).en || subscription.plan.name
                : subscription.plan.name}
            </span>
            <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
              {subscription.status}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Price: ${(subscription.plan.price_monthly / 100).toFixed(2)}/month
          </div>
          <div className="text-sm">
            <span className="font-medium">Modules:</span>{" "}
            {subscription.plan.enabled_modules.join(", ")}
          </div>
          <div className="text-sm">
            <span className="font-medium">Contexts:</span>{" "}
            {subscription.plan.enabled_contexts.join(", ")}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-800">No active subscription found</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleAccessTest() {
  const { activeOrgId } = useAppStore();
  const modules = ["home", "warehouse", "teams", "organization-management", "support"];

  return (
    <div>
      <h4 className="mb-2 font-medium">Module Access</h4>
      <div className="grid grid-cols-2 gap-2">
        {modules.map((module) => (
          <ModuleAccessItem key={module} module={module} orgId={activeOrgId} />
        ))}
      </div>
    </div>
  );
}

function ModuleAccessItem({ module, orgId }: { module: string; orgId?: string }) {
  const { data: hasAccess, isLoading } = useModuleAccess(module, orgId);

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <span className="text-sm font-medium">{module}</span>
      {isLoading ? (
        <Skeleton className="h-4 w-4" />
      ) : (
        <div className="flex items-center gap-1">
          {hasAccess ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs">{hasAccess ? "Access" : "Blocked"}</span>
        </div>
      )}
    </div>
  );
}

function FeatureAccessTest() {
  const { activeOrgId } = useAppStore();
  const features = ["api_access", "custom_branding", "priority_support", "advanced_reports"];

  return (
    <div>
      <h4 className="mb-2 font-medium">Feature Access</h4>
      <div className="grid grid-cols-2 gap-2">
        {features.map((feature) => (
          <FeatureAccessItem key={feature} feature={feature} orgId={activeOrgId} />
        ))}
      </div>
    </div>
  );
}

function FeatureAccessItem({ feature, orgId }: { feature: string; orgId?: string }) {
  const { data: hasAccess, isLoading } = useFeatureAccess(feature, orgId);

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <span className="text-sm font-medium">{feature.replace("_", " ")}</span>
      {isLoading ? (
        <Skeleton className="h-4 w-4" />
      ) : (
        <div className="flex items-center gap-1">
          {hasAccess ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs">{hasAccess ? "Available" : "Locked"}</span>
        </div>
      )}
    </div>
  );
}

function UsageLimitsTest() {
  const { activeOrgId } = useAppStore();
  const limits = ["max_products", "max_users", "max_locations"];

  return (
    <div>
      <h4 className="mb-2 font-medium">Usage Limits</h4>
      <div className="space-y-2">
        {limits.map((limit) => (
          <UsageLimitItem key={limit} limit={limit} orgId={activeOrgId} />
        ))}
      </div>
    </div>
  );
}

function UsageLimitItem({ limit, orgId }: { limit: string; orgId?: string }) {
  const { data: usageData, isLoading } = useUsageLimit(limit, orgId);

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <span className="text-sm font-medium">{limit.replace("_", " ")}</span>
      {isLoading ? (
        <Skeleton className="h-4 w-16" />
      ) : usageData ? (
        <div className="text-sm">
          {usageData.current} / {usageData.limit === -1 ? "∞" : usageData.limit}
          {usageData.isAtLimit && (
            <Badge variant="destructive" className="ml-2 text-xs">
              At Limit
            </Badge>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">No data</span>
      )}
    </div>
  );
}

function SubscriptionGateTests() {
  return (
    <div>
      <h4 className="mb-2 font-medium">Subscription Gates</h4>
      <div className="space-y-3">
        {/* Module gate test */}
        <div className="rounded border p-3">
          <h5 className="mb-2 text-sm font-medium">Module Gate (Teams)</h5>
          <SubscriptionGate module="teams">
            <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">
              ✅ Teams module content is accessible!
            </div>
          </SubscriptionGate>
        </div>

        {/* Feature gate test */}
        <div className="rounded border p-3">
          <h5 className="mb-2 text-sm font-medium">Feature Gate (API Access)</h5>
          <SubscriptionGate feature="api_access">
            <div className="rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800">
              ✅ API access features are available!
            </div>
          </SubscriptionGate>
        </div>

        {/* Feature flag test */}
        <div className="rounded border p-3">
          <h5 className="mb-2 text-sm font-medium">Feature Flag (Custom Branding)</h5>
          <FeatureFlag feature="custom_branding">
            <div className="rounded border border-purple-200 bg-purple-50 p-2 text-sm text-purple-800">
              ✅ Custom branding options would appear here
            </div>
          </FeatureFlag>
          <FeatureFlag
            feature="custom_branding"
            fallback={
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600">
                Custom branding not available on current plan
              </div>
            }
          >
            <div>This won't show</div>
          </FeatureFlag>
        </div>

        {/* Minimalist gate test */}
        <div className="rounded border p-3">
          <h5 className="mb-2 text-sm font-medium">Minimalist Gate</h5>
          <div className="flex items-center gap-2">
            <span className="text-sm">Enterprise Feature:</span>
            <SubscriptionGate feature="white_label" minimalist>
              <Badge variant="default">White Label Available</Badge>
            </SubscriptionGate>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionTests() {
  const { activeOrgId } = useAppStore();

  const testUsageIncrement = async () => {
    if (!activeOrgId) {
      toast.error("No active organization");
      return;
    }

    try {
      const success = await subscriptionService.incrementUsage(activeOrgId, "max_products", 1);
      if (success) {
        toast.success("Usage incremented successfully");
      } else {
        toast.warning("Usage increment blocked (at limit)");
      }
    } catch {
      toast.error("Error incrementing usage");
    }
  };

  return (
    <div>
      <h4 className="mb-2 font-medium">Action Tests</h4>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={testUsageIncrement}>
          Test Usage Increment
        </Button>
      </div>
    </div>
  );
}
