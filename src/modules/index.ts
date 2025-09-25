import { teamsModule } from "./teams/config";
import { orgManagmentModule } from "./organization-managment/config";
import { homeModule } from "./home/config";
import { supportModule } from "./support/config";
import { developmentModule } from "./development/config";
import { userAccountModule } from "./user-account/config";
import { ModuleConfig } from "@/lib/types/module";
import { getWarehouseModule } from "./warehouse/config";
import { getAnalyticsModule } from "./analytics/config";
import { Widget } from "@/lib/types/widgets";
import { subscriptionService } from "@/lib/services/subscription-service";

/**
 * Enhanced module interface with subscription information
 */
export interface ModuleWithAccess extends ModuleConfig {
  hasAccess: boolean;
  isPremium: boolean;
  requiredPlan?: string;
  isAlwaysAvailable?: boolean;
}

/**
 * Loads all available modules with subscription access control
 * @param activeOrgId - Organization ID for access control
 * @param subscription - Subscription data from app context (optional for server-side use)
 */
export async function getAllModules(
  activeOrgId?: string,
  subscription?: any
): Promise<ModuleWithAccess[]> {
  const warehouseModule = await getWarehouseModule();
  const analyticsModule = await getAnalyticsModule();

  // Define all modules with their access requirements based on updated subscription tiers
  const allModulesConfig = [
    // Free tier modules (always available)
    { module: homeModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: warehouseModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: teamsModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: orgManagmentModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: supportModule, alwaysAvailable: true, requiredPlan: "free" },
    { module: userAccountModule, alwaysAvailable: true, requiredPlan: "free" },

    // Professional tier modules
    { module: analyticsModule, alwaysAvailable: false, requiredPlan: "professional" },

    // Development module (always available in dev mode)
    { module: developmentModule, alwaysAvailable: true, requiredPlan: "free" },
  ];

  // Check access for each module
  const modulesWithAccess: ModuleWithAccess[] = [];

  for (const config of allModulesConfig) {
    let hasAccess = true;

    if (!config.alwaysAvailable && activeOrgId) {
      // Use subscription data from context if available, otherwise fetch from service
      if (subscription) {
        hasAccess = subscription.plan.enabled_modules.includes(config.module.id);
      } else {
        hasAccess = await subscriptionService.hasModuleAccess(activeOrgId, config.module.id);
      }
    }

    modulesWithAccess.push({
      ...config.module,
      hasAccess,
      isPremium: !config.alwaysAvailable,
      requiredPlan: config.requiredPlan,
      isAlwaysAvailable: config.alwaysAvailable,
    });
  }

  return modulesWithAccess;
}

/**
 * Get modules that user has access to
 */
export async function getAccessibleModules(
  activeOrgId?: string,
  subscription?: any
): Promise<ModuleConfig[]> {
  const allModules = await getAllModules(activeOrgId, subscription);
  return allModules.filter((module) => module.hasAccess);
}

/**
 * Get modules that require upgrade
 */
export async function getLockedModules(
  activeOrgId?: string,
  subscription?: any
): Promise<ModuleWithAccess[]> {
  const allModules = await getAllModules(activeOrgId, subscription);
  return allModules.filter((module) => !module.hasAccess && module.isPremium);
}

/**
 * Get all widgets from accessible modules
 */
export async function getAllWidgets(activeOrgId?: string, subscription?: any): Promise<Widget[]> {
  const modules = await getAllModules(activeOrgId, subscription);
  return modules.filter((m) => m.hasAccess).flatMap((module) => module.widgets || []);
}
