"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { subscriptionService } from "@/lib/services/subscription-service";

// Hook for getting subscription data
export function useSubscription(orgId?: string) {
  return useSWR(
    orgId ? `subscription:${orgId}` : null,
    async () => {
      if (!orgId) return null;
      return await subscriptionService.getActiveSubscription(orgId);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      errorRetryCount: 3,
      errorRetryInterval: 1000,
    }
  );
}

// Hook for checking module access
export function useModuleAccess(moduleName: string, orgId?: string) {
  return useSWR(
    orgId && moduleName ? `module:${orgId}:${moduleName}` : null,
    async () => {
      if (!orgId || !moduleName) return false;
      return await subscriptionService.hasModuleAccess(orgId, moduleName);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes (module access doesn't change often)
    }
  );
}

// Hook for checking context access
export function useContextAccess(contextName: string, orgId?: string) {
  return useSWR(
    orgId && contextName ? `context:${orgId}:${contextName}` : null,
    async () => {
      if (!orgId || !contextName) return false;
      return await subscriptionService.hasContextAccess(orgId, contextName);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );
}

// Hook for checking feature access
export function useFeatureAccess(featureName: string, orgId?: string) {
  return useSWR(
    orgId && featureName ? `feature:${orgId}:${featureName}` : null,
    async () => {
      if (!orgId || !featureName) return false;
      return await subscriptionService.hasFeature(orgId, featureName);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );
}

// Hook for checking usage limits
export function useUsageLimit(limitKey: string, orgId?: string) {
  return useSWR(
    orgId && limitKey ? `usage:${orgId}:${limitKey}` : null,
    async () => {
      if (!orgId || !limitKey) return null;
      return await subscriptionService.checkUsageLimit(orgId, limitKey);
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 30000, // 30 seconds (usage can change frequently)
      refreshInterval: 60000, // Refresh every minute
    }
  );
}

// Hook for getting all subscription plans
export function useSubscriptionPlans() {
  return useSWR(
    "subscription_plans",
    async () => {
      return await subscriptionService.getSubscriptionPlans();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 600000, // 10 minutes (plans don't change often)
    }
  );
}

// Hook for getting usage statistics
export function useUsageStats(orgId?: string) {
  return useSWR(
    orgId ? `usage_stats:${orgId}` : null,
    async () => {
      if (!orgId) return {};
      return await subscriptionService.getUsageStats(orgId);
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60000, // Refresh every minute
    }
  );
}

// Hook for multiple access checks (useful for complex UI logic)
export function useMultipleAccess(orgId?: string) {
  const { data: subscription } = useSubscription(orgId);

  return {
    subscription,
    hasModuleAccess: (moduleName: string) => {
      if (!subscription) return ["home", "warehouse"].includes(moduleName);
      return subscription.plan.enabled_modules.includes(moduleName);
    },
    hasContextAccess: (contextName: string) => {
      if (!subscription) return contextName === "warehouse";
      return subscription.plan.enabled_contexts.includes(contextName);
    },
    hasFeature: (featureName: string) => {
      if (!subscription) return false;
      return !!subscription.plan.features[featureName];
    },
  };
}

// Hook for development subscription management
export function useDevelopmentSubscription(orgId?: string) {
  const { mutate } = useSubscription(orgId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchPlan = async (planName: string) => {
    if (!orgId) return false;

    setIsLoading(true);
    setError(null);

    try {
      const success = await subscriptionService.setDevelopmentSubscription(orgId, planName);
      if (success) {
        // Invalidate cache and refetch
        await mutate();
        subscriptionService.clearCache(orgId);
        return true;
      } else {
        setError("Failed to switch plan");
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    switchPlan,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

// Hook for subscription status with real-time updates
export function useSubscriptionStatus(orgId?: string) {
  const { data: subscription, mutate } = useSubscription(orgId);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  // Check for subscription changes every 5 minutes
  useEffect(() => {
    if (!orgId) return;

    const interval = setInterval(
      () => {
        mutate();
        setLastChecked(new Date());
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [orgId, mutate]);

  return {
    subscription,
    status: subscription?.status || "inactive",
    isActive: subscription?.status === "active",
    isTrialing: subscription?.status === "trialing",
    isPastDue: subscription?.status === "past_due",
    isCanceled: subscription?.status === "canceled",
    lastChecked,
    refresh: () => mutate(),
  };
}

// Hook for checking if user can perform an action (combines access + usage limits)
export function useCanPerformAction(
  action: string,
  orgId?: string,
  options?: {
    requiredModule?: string;
    requiredFeature?: string;
    usageLimitKey?: string;
  }
) {
  const { data: moduleAccess } = useModuleAccess(options?.requiredModule || "", orgId);
  const { data: featureAccess } = useFeatureAccess(options?.requiredFeature || "", orgId);
  const { data: usageLimit } = useUsageLimit(options?.usageLimitKey || "", orgId);

  const canPerform = () => {
    // Check module access
    if (options?.requiredModule && !moduleAccess) return false;

    // Check feature access
    if (options?.requiredFeature && !featureAccess) return false;

    // Check usage limits
    if (options?.usageLimitKey && usageLimit && !usageLimit.canProceed) return false;

    return true;
  };

  return {
    canPerform: canPerform(),
    reasons: {
      moduleAccess,
      featureAccess,
      usageLimit,
      hasModuleAccess: !options?.requiredModule || !!moduleAccess,
      hasFeatureAccess: !options?.requiredFeature || !!featureAccess,
      withinUsageLimit: !options?.usageLimitKey || (usageLimit?.canProceed ?? true),
    },
  };
}
