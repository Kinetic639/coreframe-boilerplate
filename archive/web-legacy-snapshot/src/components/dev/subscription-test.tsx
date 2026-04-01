"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, XCircle, AlertTriangle, Settings } from "lucide-react";
import { useSubscription, useModuleAccess, useUsageLimit } from "@/hooks/use-subscription";
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
          <CardDescription>Testing subscription access controls and plan switching</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PlanSwitcher />
          <SubscriptionStatusTest />
          <ModuleAccessTest />
          <UsageLimitsTest />
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

function PlanSwitcher() {
  const { activeOrgId } = useAppStore();
  const [selectedPlan, setSelectedPlan] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePlanChange = async (planName: string) => {
    if (!activeOrgId) {
      toast.error("No active organization");
      return;
    }

    setIsLoading(true);
    try {
      // Call subscription service to set development subscription
      const success = await subscriptionService.setDevelopmentSubscription(activeOrgId, planName);
      if (success) {
        toast.success(`Plan changed to ${planName}`);
        // Refresh the page to see changes
        window.location.reload();
      } else {
        toast.error("Failed to change plan");
      }
    } catch (error) {
      toast.error("Error changing plan");
      console.error("Error changing plan:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h4 className="mb-2 font-medium">Plan Switcher</h4>
      <div className="flex items-center gap-4">
        <Select value={selectedPlan} onValueChange={setSelectedPlan} disabled={isLoading}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free Plan</SelectItem>
            <SelectItem value="professional">Professional Plan</SelectItem>
            <SelectItem value="enterprise">Enterprise Plan</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => handlePlanChange(selectedPlan)}
          disabled={!selectedPlan || isLoading}
        >
          {isLoading ? "Switching..." : "Switch Plan"}
        </Button>
      </div>
    </div>
  );
}

function ModuleAccessTest() {
  const { activeOrgId } = useAppStore();
  const modules = ["home", "warehouse", "teams", "organization-management", "support", "analytics"];

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
