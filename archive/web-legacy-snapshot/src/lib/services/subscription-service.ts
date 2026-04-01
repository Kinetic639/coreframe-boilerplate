import { createClient } from "@/utils/supabase/client";
import type { Tables } from "../../../supabase/types/types";

// Type definitions
export type SubscriptionPlan = Tables<"subscription_plans">;
export type OrganizationSubscription = Tables<"organization_subscriptions">;
export type SubscriptionUsage = Tables<"subscription_usage">;

export interface SubscriptionPlanWithDetails extends SubscriptionPlan {
  features: Record<string, boolean | number>;
  limits: Record<string, number>;
  enabled_modules: string[];
  enabled_contexts: string[];
}

export interface OrganizationSubscriptionWithPlan extends OrganizationSubscription {
  plan: SubscriptionPlanWithDetails;
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export interface UsageLimitCheck {
  current: number;
  limit: number;
  isAtLimit: boolean;
  remaining: number;
  canProceed: boolean;
}

export class SubscriptionService {
  private supabase = createClient();
  private cache = new Map<string, { data: any; expires: number }>();

  // Cache helper
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttlSeconds: number = 300): T {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
    return data;
  }

  // Get all available subscription plans
  async getSubscriptionPlans(): Promise<SubscriptionPlanWithDetails[]> {
    const cacheKey = "subscription_plans";
    const cached = this.getCached<SubscriptionPlanWithDetails[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await this.supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;

      const plans = (data || []).map((plan) => ({
        ...plan,
        features:
          typeof plan.features === "object" && plan.features !== null
            ? (plan.features as Record<string, boolean | number>)
            : {},
        limits:
          typeof plan.limits === "object" && plan.limits !== null
            ? (plan.limits as Record<string, number>)
            : {},
        enabled_modules: plan.enabled_modules || [],
        enabled_contexts: plan.enabled_contexts || [],
      }));

      return this.setCache(cacheKey, plans);
    } catch (error) {
      console.error("Error getting subscription plans:", error);
      throw error;
    }
  }

  // Get active subscription for organization
  async getActiveSubscription(orgId: string): Promise<OrganizationSubscriptionWithPlan | null> {
    if (!orgId) return null;

    const cacheKey = `subscription:${orgId}`;
    const cached = this.getCached<OrganizationSubscriptionWithPlan>(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await this.supabase
        .from("organization_subscriptions")
        .select(
          `
          *,
          plan:subscription_plans(*)
        `
        )
        .eq("organization_id", orgId)
        .eq("status", "active")
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      if (!data?.plan) return null;

      const subscription: OrganizationSubscriptionWithPlan = {
        ...data,
        plan: {
          ...data.plan,
          features:
            typeof data.plan.features === "object" && data.plan.features !== null
              ? (data.plan.features as Record<string, boolean | number>)
              : {},
          limits:
            typeof data.plan.limits === "object" && data.plan.limits !== null
              ? (data.plan.limits as Record<string, number>)
              : {},
          enabled_modules: data.plan.enabled_modules || [],
          enabled_contexts: data.plan.enabled_contexts || [],
        },
      };

      return this.setCache(cacheKey, subscription, 300);
    } catch (error) {
      console.error("Error getting active subscription:", error);
      return null;
    }
  }

  // Check module access
  async hasModuleAccess(orgId: string, moduleName: string): Promise<boolean> {
    if (!orgId || !moduleName) return false;

    // Always allow access to default modules
    if (this.isDefaultModule(moduleName)) return true;

    const subscription = await this.getActiveSubscription(orgId);
    if (!subscription) return false;

    return subscription.plan.enabled_modules.includes(moduleName);
  }

  // Check context access
  async hasContextAccess(orgId: string, contextName: string): Promise<boolean> {
    if (!orgId || !contextName) return false;

    // Always allow warehouse context
    if (contextName === "warehouse") return true;

    const subscription = await this.getActiveSubscription(orgId);
    if (!subscription) return false;

    return subscription.plan.enabled_contexts.includes(contextName);
  }

  // Check feature access
  async hasFeature(orgId: string, featureName: string): Promise<boolean> {
    if (!orgId || !featureName) return false;

    const subscription = await this.getActiveSubscription(orgId);
    if (!subscription) return false;

    return !!subscription.plan.features[featureName];
  }

  // Check usage limits
  async checkUsageLimit(orgId: string, limitKey: string): Promise<UsageLimitCheck> {
    if (!orgId || !limitKey) {
      return { current: 0, limit: 0, isAtLimit: true, remaining: 0, canProceed: false };
    }

    try {
      const subscription = await this.getActiveSubscription(orgId);
      const limit = subscription?.plan.limits[limitKey] ?? 0;

      // -1 means unlimited
      if (limit === -1) {
        return {
          current: 0,
          limit: -1,
          isAtLimit: false,
          remaining: Infinity,
          canProceed: true,
        };
      }

      // Get current usage for this period
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: usage } = await this.supabase
        .from("subscription_usage")
        .select("current_value")
        .eq("organization_id", orgId)
        .eq("feature_key", limitKey)
        .eq("period_start", periodStart.toISOString())
        .single();

      const current = usage?.current_value ?? 0;
      const remaining = Math.max(0, limit - current);
      const isAtLimit = current >= limit;

      return {
        current,
        limit,
        isAtLimit,
        remaining,
        canProceed: !isAtLimit,
      };
    } catch (error) {
      console.error("Error checking usage limit:", error);
      return { current: 0, limit: 0, isAtLimit: true, remaining: 0, canProceed: false };
    }
  }

  // Increment usage counter
  async incrementUsage(orgId: string, featureKey: string, increment: number = 1): Promise<boolean> {
    if (!orgId || !featureKey) return false;

    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Check if we can proceed before incrementing
      const usageCheck = await this.checkUsageLimit(orgId, featureKey);
      if (!usageCheck.canProceed && usageCheck.limit !== -1) {
        return false;
      }

      // Upsert usage record
      const { error } = await this.supabase.from("subscription_usage").upsert(
        {
          organization_id: orgId,
          feature_key: featureKey,
          current_value: usageCheck.current + increment,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        },
        {
          onConflict: "organization_id,feature_key,period_start",
        }
      );

      if (error) throw error;

      // Clear cache for this organization
      this.cache.delete(`subscription:${orgId}`);

      return true;
    } catch (error) {
      console.error("Error incrementing usage:", error);
      return false;
    }
  }

  // Development helper: Set organization subscription
  async setDevelopmentSubscription(orgId: string, planName: string): Promise<boolean> {
    if (!orgId || !planName) return false;

    try {
      const { data: plan } = await this.supabase
        .from("subscription_plans")
        .select("*")
        .eq("name", planName)
        .single();

      if (!plan) {
        throw new Error(`Plan ${planName} not found`);
      }

      // Upsert subscription
      const { error } = await this.supabase.from("organization_subscriptions").upsert(
        {
          organization_id: orgId,
          plan_id: plan.id,
          status: "active",
          is_development: true,
          dev_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          onConflict: "organization_id",
        }
      );

      if (error) throw error;

      // Clear cache
      this.cache.delete(`subscription:${orgId}`);

      return true;
    } catch (error) {
      console.error("Error setting development subscription:", error);
      return false;
    }
  }

  // Get subscription by plan name (for development)
  async getSubscriptionByPlan(planName: string): Promise<SubscriptionPlanWithDetails | null> {
    try {
      const plans = await this.getSubscriptionPlans();
      return plans.find((plan) => plan.name === planName) || null;
    } catch (error) {
      console.error("Error getting subscription by plan:", error);
      return null;
    }
  }

  // Clear cache for organization
  clearCache(orgId?: string): void {
    if (orgId) {
      this.cache.delete(`subscription:${orgId}`);
    } else {
      this.cache.clear();
    }
  }

  // Helper methods
  private isDefaultModule(moduleName: string): boolean {
    return ["home", "warehouse"].includes(moduleName);
  }

  // Get usage for organization
  async getUsageStats(orgId: string): Promise<Record<string, number>> {
    if (!orgId) return {};

    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: usage } = await this.supabase
        .from("subscription_usage")
        .select("feature_key, current_value")
        .eq("organization_id", orgId)
        .eq("period_start", periodStart.toISOString());

      const stats: Record<string, number> = {};
      (usage || []).forEach((item) => {
        stats[item.feature_key] = item.current_value;
      });

      return stats;
    } catch (error) {
      console.error("Error getting usage stats:", error);
      return {};
    }
  }

  // Check if organization has any active subscription
  async hasActiveSubscription(orgId: string): Promise<boolean> {
    const subscription = await this.getActiveSubscription(orgId);
    return !!subscription;
  }

  // Get plan features as array for easy checking
  async getPlanFeatures(orgId: string): Promise<string[]> {
    const subscription = await this.getActiveSubscription(orgId);
    if (!subscription) return [];

    return Object.entries(subscription.plan.features)
      .filter(([_, enabled]) => !!enabled)
      .map(([feature, _]) => feature);
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
