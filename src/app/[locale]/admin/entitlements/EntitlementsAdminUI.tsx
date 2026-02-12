"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { LIMIT_KEYS } from "@/lib/types/entitlements";
import type { OrganizationEntitlements } from "@/lib/types/entitlements";
import type { Tables } from "../../../../../supabase/types/types";
import {
  actionSwitchPlan,
  actionAddModuleAddon,
  actionRemoveModuleAddon,
  actionSetLimitOverride,
  actionResetToFree,
} from "./actions";

interface Props {
  orgId: string;
  entitlements: OrganizationEntitlements | null;
  plans: Tables<"subscription_plans">[];
  addons: Tables<"organization_module_addons">[];
  overrides: Tables<"organization_limit_overrides">[];
  availableModuleSlugs: string[];
  devModeEnabled: boolean;
}

export function EntitlementsAdminUI({
  orgId: _orgId,
  entitlements,
  plans,
  addons,
  overrides,
  availableModuleSlugs,
  devModeEnabled,
}: Props) {
  const router = useRouter();
  // Per-action loading: null = idle, string = action key currently running
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [newModuleSlug, setNewModuleSlug] = useState("");
  const [newLimitKey, setNewLimitKey] = useState("");
  const [newLimitValue, setNewLimitValue] = useState("");

  /**
   * Switch plan via server action
   */
  async function switchPlan(planName: string) {
    const actionKey = `switch-plan-${planName}`;
    setLoadingAction(actionKey);
    try {
      const res = await actionSwitchPlan(planName);
      if (res.ok === false) throw new Error(res.message);

      toast.success(`Switched to ${planName} plan`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to switch plan");
    } finally {
      setLoadingAction(null);
    }
  }

  /**
   * Add module addon via server action
   */
  async function addModuleAddon() {
    if (!newModuleSlug) {
      toast.error("Please select a module");
      return;
    }

    setLoadingAction("add-module-addon");
    try {
      const res = await actionAddModuleAddon(newModuleSlug);
      if (res.ok === false) throw new Error(res.message);

      toast.success(`Added ${newModuleSlug} addon`);
      setNewModuleSlug("");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to add addon");
    } finally {
      setLoadingAction(null);
    }
  }

  /**
   * Remove module addon via server action
   */
  async function removeModuleAddon(moduleSlug: string) {
    setLoadingAction(`remove-addon-${moduleSlug}`);
    try {
      const res = await actionRemoveModuleAddon(moduleSlug);
      if (res.ok === false) throw new Error(res.message);

      toast.success(`Removed ${moduleSlug} addon`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove addon");
    } finally {
      setLoadingAction(null);
    }
  }

  /**
   * Set limit override via server action
   */
  async function setLimitOverride() {
    if (!newLimitKey || !newLimitValue.trim()) {
      toast.error("Please select a limit key and enter a value");
      return;
    }

    const value = parseInt(newLimitValue, 10);
    if (isNaN(value)) {
      toast.error("Limit value must be a number");
      return;
    }

    setLoadingAction("set-limit-override");
    try {
      const res = await actionSetLimitOverride(newLimitKey, value);
      if (res.ok === false) throw new Error(res.message);

      toast.success(`Set override for ${newLimitKey}`);
      setNewLimitKey("");
      setNewLimitValue("");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to set override");
    } finally {
      setLoadingAction(null);
    }
  }

  /**
   * Reset to free plan via server action
   */
  async function resetToFree() {
    if (!confirm("This will remove all addons and overrides. Continue?")) {
      return;
    }

    setLoadingAction("reset-to-free");
    try {
      const res = await actionResetToFree();
      if (res.ok === false) throw new Error(res.message);

      toast.success("Reset to free plan");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to reset");
    } finally {
      setLoadingAction(null);
    }
  }

  if (!devModeEnabled) {
    return (
      <Card className="border-yellow-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Dev Mode Disabled
          </CardTitle>
          <CardDescription>
            Dev mode is not enabled. Enable it in the database to use dev RPCs:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="bg-muted p-2 rounded text-sm block">
            UPDATE public.app_config SET dev_mode_enabled = true WHERE id = 1;
          </code>
        </CardContent>
      </Card>
    );
  }

  if (!entitlements) {
    return (
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Entitlements Missing
          </CardTitle>
          <CardDescription>
            No entitlements found for this organization. Run recompute_all_entitlements().
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan & Entitlements */}
      <Card>
        <CardHeader>
          <CardTitle>Current Entitlements</CardTitle>
          <CardDescription>
            Your organization&apos;s current plan and computed entitlements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan */}
          <div>
            <Label className="text-sm text-muted-foreground">Plan</Label>
            <p className="text-2xl font-bold capitalize">{entitlements.plan_name}</p>
          </div>

          {/* Enabled Modules */}
          <div>
            <Label className="text-sm text-muted-foreground">Enabled Modules</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {entitlements.enabled_modules.map((module) => (
                <Badge key={module} variant="secondary">
                  {module}
                </Badge>
              ))}
            </div>
          </div>

          {/* Limits */}
          <div>
            <Label className="text-sm text-muted-foreground">Limits</Label>
            <div className="mt-2 space-y-2">
              {Object.entries(entitlements.limits).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm font-mono">{key}</span>
                  <span className="font-bold">
                    {value === -1 ? (
                      <Badge variant="outline" className="gap-1">
                        <Unlock className="h-3 w-3" />
                        Unlimited
                      </Badge>
                    ) : (
                      value
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          {Object.keys(entitlements.features).length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground">Features</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(entitlements.features).map(([key, value]) => (
                  <Badge key={key} variant={value ? "default" : "outline"}>
                    {value ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Switch Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Switch Plan
          </CardTitle>
          <CardDescription>Test different subscription plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.name === entitlements.plan_name;
              return (
                <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {typeof plan.display_name === "object" && plan.display_name !== null
                        ? (plan.display_name as any).en || plan.name
                        : plan.name}
                    </CardTitle>
                    {typeof plan.description === "object" && plan.description !== null && (
                      <CardDescription>{(plan.description as any).en || ""}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => switchPlan(plan.name)}
                      disabled={loadingAction !== null || isCurrent}
                      className="w-full"
                      variant={isCurrent ? "secondary" : "default"}
                    >
                      {loadingAction === `switch-plan-${plan.name}` ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Switching...
                        </>
                      ) : isCurrent ? (
                        "Current Plan"
                      ) : (
                        "Switch to This Plan"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Module Addons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Module Addons
          </CardTitle>
          <CardDescription>Add or remove module addons (beyond base plan)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Addons */}
          {addons.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Active Addons</Label>
              <div className="space-y-2">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <span className="font-mono text-sm">{addon.module_slug}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeModuleAddon(addon.module_slug)}
                      disabled={loadingAction !== null}
                    >
                      {loadingAction === `remove-addon-${addon.module_slug}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Addon */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Add New Addon</Label>
            <div className="flex gap-2">
              <Select
                value={newModuleSlug}
                onValueChange={setNewModuleSlug}
                disabled={loadingAction !== null}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a module..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModuleSlugs.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addModuleAddon} disabled={loadingAction !== null}>
                {loadingAction === "add-module-addon" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Limit Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            Limit Overrides
          </CardTitle>
          <CardDescription>Override specific limits (custom values per org)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Overrides */}
          {overrides.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Active Overrides</Label>
              <div className="space-y-2">
                {overrides.map((override) => (
                  <div
                    key={override.id}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <span className="font-mono text-sm">{override.limit_key}</span>
                    <span className="font-bold">{override.override_value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Override */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Add New Override</Label>
            <div className="flex gap-2">
              <Select
                value={newLimitKey}
                onValueChange={setNewLimitKey}
                disabled={loadingAction !== null}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a limit key..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(LIMIT_KEYS).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Value"
                value={newLimitValue}
                onChange={(e) => setNewLimitValue(e.target.value)}
                disabled={loadingAction !== null}
                className="w-32"
              />
              <Button onClick={setLimitOverride} disabled={loadingAction !== null}>
                {loadingAction === "set-limit-override" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Use -1 for unlimited</p>
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <RefreshCw className="h-5 w-5" />
            Reset to Free Plan
          </CardTitle>
          <CardDescription>Remove all addons and overrides, reset to free plan</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={resetToFree} disabled={loadingAction !== null}>
            {loadingAction === "reset-to-free" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Reset to Free
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
