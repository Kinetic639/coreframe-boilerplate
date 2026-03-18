import React from "react";
import { getTranslations } from "next-intl/server";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const t = await getTranslations("organization.billing");

  // Get all translations for the billing namespace
  const translations = {
    title: t("title"),
    description: t("description"),
    noSubscription: {
      title: t("noSubscription.title"),
      description: t("noSubscription.description"),
    },
    currentPlan: {
      title: t("currentPlan.title"),
      subtitle: t("currentPlan.subtitle"),
    },
    status: {
      active: t("status.active"),
      trialing: t("status.trialing"),
      past_due: t("status.past_due"),
      canceled: t("status.canceled"),
      unpaid: t("status.unpaid"),
      incomplete: t("status.incomplete"),
    },
    developmentPlan: t("developmentPlan"),
    perMonth: t("perMonth"),
    billingPeriod: t("billingPeriod"),
    planIncludes: t("planIncludes"),
    modules: t("modules"),
    contexts: t("contexts"),
    users: t("users"),
    branches: t("branches"),
    products: t("products"),
    locations: t("locations"),
    unlimited: t("unlimited"),
    availableModules: {
      title: t("availableModules.title"),
      description: t("availableModules.description"),
    },
    availableContexts: {
      title: t("availableContexts.title"),
      description: t("availableContexts.description"),
    },
    moduleNames: {
      home: t("moduleNames.home"),
      warehouse: t("moduleNames.warehouse"),
      teams: t("moduleNames.teams"),
      "organization-management": t("moduleNames.organization-management"),
      support: t("moduleNames.support"),
      "user-account": t("moduleNames.user-account"),
      analytics: t("moduleNames.analytics"),
      development: t("moduleNames.development", { defaultValue: "Development" }),
    },
    contextNames: {
      warehouse: t("contextNames.warehouse", { defaultValue: "Warehouse" }),
      branch: t("contextNames.branch", { defaultValue: "Branch" }),
      organization: t("contextNames.organization", { defaultValue: "Organization" }),
    },
    contextDescriptions: {
      warehouse: t("contextDescriptions.warehouse", {
        defaultValue: "Warehouse management context",
      }),
      branch: t("contextDescriptions.branch", { defaultValue: "Branch-specific context" }),
      organization: t("contextDescriptions.organization", {
        defaultValue: "Organization-wide context",
      }),
    },
  };

  return <BillingClient translations={translations} />;
}
