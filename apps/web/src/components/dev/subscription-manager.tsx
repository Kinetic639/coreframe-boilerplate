"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Settings,
  Zap,
  Package,
  MapPin,
  Clock,
  ChevronDown,
  RefreshCw,
  Bug,
  CheckCircle,
  XCircle,
  Loader2,
  X,
} from "lucide-react";
import {
  useSubscription,
  useSubscriptionPlans,
  useDevelopmentSubscription,
  useUsageStats,
} from "@/hooks/use-subscription";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";

interface DevelopmentSubscriptionManagerProps {
  className?: string;
  position?: "fixed" | "relative";
}

export function DevelopmentSubscriptionManager({
  className,
  position = "fixed",
}: DevelopmentSubscriptionManagerProps) {
  const { activeOrgId } = useAppStore();
  const { data: subscription, isLoading, mutate } = useSubscription(activeOrgId);
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: usageStats } = useUsageStats(activeOrgId);
  const { switchPlan, isLoading: isSwitching, error } = useDevelopmentSubscription(activeOrgId);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development" || isHidden) {
    return null;
  }

  const handlePlanSwitch = async () => {
    if (!selectedPlan || !activeOrgId) return;

    try {
      const success = await switchPlan(selectedPlan);
      if (success) {
        toast.success(`Successfully switched to ${selectedPlan} plan!`);
        setSelectedPlan("");
        setIsOpen(false);
      } else {
        toast.error(`Failed to switch to ${selectedPlan} plan`);
      }
    } catch {
      toast.error("Error switching plan");
    }
  };

  const currentPlan = subscription?.plan;
  const isDevSubscription = subscription?.is_development;

  const cardClasses = cn(
    "border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-lg",
    position === "fixed" ? "fixed bottom-4 right-4 z-50 w-80" : "w-full",
    className
  );

  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Bug className="h-4 w-4 text-yellow-600" />
              <CardTitle className="text-sm text-yellow-800">Dev Subscription</CardTitle>
            </div>
            {subscription && (
              <Badge variant={isDevSubscription ? "default" : "secondary"} className="text-xs">
                {currentPlan?.name || "none"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(!isCollapsed)}>
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", isCollapsed ? "" : "rotate-180")}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHidden(true)}
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {!isCollapsed && (
          <CardDescription className="text-xs text-yellow-700">
            Development mode subscription testing
          </CardDescription>
        )}
      </CardHeader>

      <Collapsible open={!isCollapsed} onOpenChange={setIsCollapsed}>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Current Plan Info */}
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : subscription ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-700">Plan:</span>
                  <span className="font-medium text-yellow-800">{currentPlan?.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-700">Status:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      subscription.status === "active"
                        ? "border-green-300 text-green-700"
                        : "border-red-300 text-red-700"
                    )}
                  >
                    {subscription.status}
                  </Badge>
                </div>
                {isDevSubscription && (
                  <div className="flex items-center gap-1 text-xs text-yellow-600">
                    <Clock className="h-3 w-3" />
                    <span>Dev subscription</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-yellow-700">No subscription found</div>
            )}

            {/* Quick Actions */}
            <div className="space-y-2">
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="w-full text-xs">
                    <Settings className="mr-2 h-3 w-3" />
                    Switch Plan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Development Subscription Manager</DialogTitle>
                    <DialogDescription>
                      Switch between different subscription plans for testing purposes. This only
                      works in development mode.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    {/* Current Plan Details */}
                    {subscription && (
                      <div className="rounded-lg bg-gray-50 p-4">
                        <h4 className="mb-2 font-medium">Current Plan</h4>
                        <SubscriptionPlanCard plan={subscription.plan} isCurrent />
                      </div>
                    )}

                    {/* Plan Selection */}
                    <div>
                      <h4 className="mb-3 font-medium">Available Plans</h4>
                      {plansLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {plans?.map((plan) => (
                            <div key={plan.id} className="flex items-center gap-3">
                              <input
                                type="radio"
                                id={`plan-${plan.id}`}
                                name="plan"
                                value={plan.name}
                                checked={selectedPlan === plan.name}
                                onChange={(e) => setSelectedPlan(e.target.value)}
                                className="h-4 w-4"
                              />
                              <label htmlFor={`plan-${plan.id}`} className="flex-1 cursor-pointer">
                                <SubscriptionPlanCard
                                  plan={plan}
                                  isCompact
                                  isCurrent={plan.name === subscription?.plan.name}
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Usage Stats */}
                    {usageStats && Object.keys(usageStats).length > 0 && (
                      <div>
                        <h4 className="mb-2 font-medium">Current Usage</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(usageStats).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600">{key.replace("_", " ")}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {error && (
                      <div className="rounded-lg bg-red-50 p-3">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-800">{error}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        onClick={() => {
                          mutate();
                          toast.info("Subscription data refreshed");
                        }}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handlePlanSwitch} disabled={!selectedPlan || isSwitching}>
                          {isSwitching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Switch Plan
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  mutate();
                  toast.info("Refreshed subscription data");
                }}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Refresh
              </Button>
            </div>

            {/* Quick Info */}
            {currentPlan && (
              <div className="border-t border-yellow-200 pt-2">
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className="text-center">
                    <div className="text-yellow-600">Modules</div>
                    <div className="font-medium">{currentPlan.enabled_modules.length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-600">Contexts</div>
                    <div className="font-medium">{currentPlan.enabled_contexts.length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-600">Features</div>
                    <div className="font-medium">
                      {Object.values(currentPlan.features).filter(Boolean).length}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface SubscriptionPlanCardProps {
  plan: any;
  isCompact?: boolean;
  isCurrent?: boolean;
}

function SubscriptionPlanCard({
  plan,
  isCompact = false,
  isCurrent = false,
}: SubscriptionPlanCardProps) {
  const displayName =
    typeof plan.display_name === "object"
      ? plan.display_name.en || plan.display_name.pl || plan.name
      : plan.name;

  if (isCompact) {
    return (
      <div
        className={cn(
          "rounded-lg border p-3 transition-colors",
          isCurrent ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-gray-300"
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{displayName}</span>
              {isCurrent && (
                <Badge variant="outline" className="text-xs">
                  Current
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {plan.enabled_modules.length} modules • {plan.enabled_contexts.length} contexts
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">${(plan.price_monthly / 100).toFixed(0)}/mo</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isCurrent ? "border-blue-300 bg-blue-50" : "border-gray-200"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <h5 className="font-medium">{displayName}</h5>
        {isCurrent && (
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="mr-1 h-3 w-3" />
            Current
          </Badge>
        )}
      </div>

      <div className="mb-2 text-2xl font-bold">
        ${(plan.price_monthly / 100).toFixed(0)}
        <span className="text-sm font-normal text-gray-600">/month</span>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-gray-500" />
          <span>{plan.enabled_modules.length} modules</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span>{plan.enabled_contexts.length} contexts</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-gray-500" />
          <span>{Object.values(plan.features).filter(Boolean).length} features</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-700">Key Limits:</div>
        <div className="space-y-1 text-xs text-gray-600">
          {plan.limits.max_products !== undefined && (
            <div>
              Products: {plan.limits.max_products === -1 ? "Unlimited" : plan.limits.max_products}
            </div>
          )}
          {plan.limits.max_users !== undefined && (
            <div>Users: {plan.limits.max_users === -1 ? "Unlimited" : plan.limits.max_users}</div>
          )}
        </div>
      </div>
    </div>
  );
}
