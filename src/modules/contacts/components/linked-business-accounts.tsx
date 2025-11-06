"use client";

// =============================================
// Linked Business Accounts Component
// Display business accounts (clients/suppliers) linked to this contact
// =============================================

import * as React from "react";
import { Building2, ExternalLink, Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { LinkedBusinessAccount } from "../types";

interface LinkedBusinessAccountsProps {
  linkedAccounts: LinkedBusinessAccount[];
  isLoading?: boolean;
}

export function LinkedBusinessAccounts({
  linkedAccounts,
  isLoading = false,
}: LinkedBusinessAccountsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading linked business accounts...</p>
        </div>
      </div>
    );
  }

  if (!linkedAccounts || linkedAccounts.length === 0) {
    return (
      <div className="text-center p-8 border-2 border-dashed rounded-lg">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium text-lg mb-1">No Linked Business Accounts</h3>
        <p className="text-sm text-muted-foreground">
          This contact is not currently linked to any clients or suppliers
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This contact is linked to {linkedAccounts.length} business{" "}
        {linkedAccounts.length === 1 ? "account" : "accounts"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {linkedAccounts.map((account) => (
          <Card key={account.id} className="p-4 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">{account.name}</h4>
                  <div className="flex gap-2 mt-1">
                    <Badge
                      variant={account.partner_type === "customer" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {account.partner_type === "customer" ? "Client" : "Supplier"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {account.entity_type === "business" ? "Business" : "Individual"}
                    </Badge>
                    {!account.is_active && (
                      <Badge variant="destructive" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-1 mb-3">
              {account.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <a href={`mailto:${account.email}`} className="hover:text-primary">
                    {account.email}
                  </a>
                </div>
              )}
              {account.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${account.phone}`} className="hover:text-primary">
                    {account.phone}
                  </a>
                </div>
              )}
            </div>

            {/* View Button */}
            <Link
              href={
                account.partner_type === "customer"
                  ? "/dashboard/warehouse/clients"
                  : "/dashboard/warehouse/suppliers"
              }
            >
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink className="h-3 w-3 mr-2" />
                View {account.partner_type === "customer" ? "Client" : "Supplier"}
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
