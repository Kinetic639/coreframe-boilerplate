"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Package, AlertCircle } from "lucide-react";
import type { BillingOverview } from "@/server/services/organization.service";

interface BillingClientProps {
  initialBilling: BillingOverview | null;
}

const MODULE_LABELS: Record<string, string> = {
  home: "Home",
  warehouse: "Warehouse",
  teams: "Teams",
  "organization-management": "Organization",
  support: "Support",
  "user-account": "Account",
  analytics: "Analytics",
  development: "Development",
};

export function BillingClient({ initialBilling }: BillingClientProps) {
  const [billing] = useState<BillingOverview | null>(initialBilling);

  if (!billing) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>No billing information available.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 max-w-2xl">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your active subscription plan details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold capitalize">{billing.plan_name}</span>
            <Badge variant="secondary" className="capitalize">
              {billing.plan_name}
            </Badge>
          </div>
          {billing.updated_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last updated: {new Date(billing.updated_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Enabled Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Available Modules
          </CardTitle>
          <CardDescription>Modules included in your current subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          {billing.enabled_modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules enabled.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {billing.enabled_modules.map((mod) => (
                <Badge key={mod} variant="outline">
                  {MODULE_LABELS[mod] ?? mod}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
