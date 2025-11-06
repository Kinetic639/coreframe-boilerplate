"use client";

// =============================================
// Linked Business Accounts Tab (Read-Only)
// Shows which clients/suppliers are linked to this contact
// =============================================

import * as React from "react";
import { LinkedBusinessAccounts } from "../linked-business-accounts";
import { contactsService } from "../../api/contacts-service";
import type { LinkedBusinessAccount } from "../../types";

interface LinkedBusinessAccountsTabProps {
  contactId?: string;
}

export function LinkedBusinessAccountsTab({ contactId }: LinkedBusinessAccountsTabProps) {
  const [linkedAccounts, setLinkedAccounts] = React.useState<LinkedBusinessAccount[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (contactId) {
      loadLinkedAccounts();
    }
  }, [contactId]);

  const loadLinkedAccounts = async () => {
    if (!contactId) return;

    setIsLoading(true);
    try {
      const accounts = await contactsService.getLinkedBusinessAccounts(contactId);
      setLinkedAccounts(accounts);
    } catch (error) {
      console.error("Failed to load linked business accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!contactId) {
    return (
      <div className="text-center p-8 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">
          Save the contact first to view linked business accounts
        </p>
      </div>
    );
  }

  return <LinkedBusinessAccounts linkedAccounts={linkedAccounts} isLoading={isLoading} />;
}
