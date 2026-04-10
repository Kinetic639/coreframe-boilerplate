"use client";

// =============================================
// Linked Business Accounts Tab
// Shows and manages which clients/suppliers are linked to this contact
// Redesigned with inline select (no nested dialogs)
// =============================================

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, Unlink, Lock, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { contactsService } from "../../api/contacts-service";
import { createClient } from "@/utils/supabase/client";
import { useAppStore } from "@/lib/stores/app-store";
import type { LinkedBusinessAccount } from "../../types";
import { toast } from "react-toastify";

interface LinkedBusinessAccountsTabProps {
  contactId?: string;
  contactVisibilityScope?: "private" | "organization";
  onPromoteToOrganization?: () => void;
}

export function LinkedBusinessAccountsTab({
  contactId,
  contactVisibilityScope,
  onPromoteToOrganization,
}: LinkedBusinessAccountsTabProps) {
  const [linkedAccounts, setLinkedAccounts] = React.useState<LinkedBusinessAccount[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [availableAccounts, setAvailableAccounts] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(false);
  const [isLinking, setIsLinking] = React.useState(false);
  const { activeOrg } = useAppStore();

  const isPrivateContact = contactVisibilityScope === "private";

  React.useEffect(() => {
    if (contactId) {
      loadLinkedAccounts();
      loadAvailableAccounts();
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

  const loadAvailableAccounts = async () => {
    if (!activeOrg?.organization_id) return;

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("business_accounts")
        .select("id, name, partner_type, entity_type, email, phone")
        .eq("organization_id", activeOrg.organization_id)
        .is("deleted_at", null)
        .is("contact_id", null)
        .order("name");

      if (error) throw error;
      setAvailableAccounts(data || []);
    } catch (error) {
      console.error("Failed to load available accounts:", error);
      toast.error("Failed to load available accounts");
    }
  };

  const handleLinkAccount = async (accountId: string) => {
    if (!contactId) return;

    setIsLinking(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("business_accounts")
        .update({ contact_id: contactId })
        .eq("id", accountId);

      if (error) throw error;

      toast.success("Business account linked successfully");
      await loadLinkedAccounts();
      await loadAvailableAccounts();
      setOpen(false);
    } catch (error) {
      console.error("Failed to link account:", error);
      toast.error("Failed to link business account");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkAccount = async (accountId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("business_accounts")
        .update({ contact_id: null })
        .eq("id", accountId);

      if (error) throw error;

      toast.success("Business account unlinked successfully");
      await loadLinkedAccounts();
      await loadAvailableAccounts();
    } catch (error) {
      console.error("Failed to unlink account:", error);
      toast.error("Failed to unlink business account");
    }
  };

  if (!contactId) {
    return (
      <div className="text-center p-8 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">
          Save the contact first to manage linked business accounts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning for private contacts */}
      {isPrivateContact && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Private Contact - Linking Disabled</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Private contacts cannot be linked to business accounts because other organization
              members won't be able to view the contact information.
            </p>
            {onPromoteToOrganization && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onPromoteToOrganization}
              >
                Change to Organization Contact
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Add New Link Section */}
      {!isPrivateContact && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Link this contact to business accounts (clients or suppliers)
          </p>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" disabled={isPrivateContact || isLinking}>
                <Plus className="h-4 w-4 mr-2" />
                Link Business Account
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search business accounts..." />
                <CommandList>
                  <CommandEmpty>No available business accounts found.</CommandEmpty>
                  <CommandGroup heading="Available Accounts">
                    {availableAccounts.map((account) => (
                      <CommandItem
                        key={account.id}
                        value={account.name}
                        onSelect={() => handleLinkAccount(account.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{account.name}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge
                                variant={
                                  account.partner_type === "customer" ? "default" : "secondary"
                                }
                                className="text-xs"
                              >
                                {account.partner_type === "customer" ? "Client" : "Supplier"}
                              </Badge>
                              {account.email && (
                                <span className="text-xs text-muted-foreground">
                                  {account.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Linked Accounts List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">Loading...</CardContent>
        </Card>
      ) : linkedAccounts.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium text-lg mb-1">No Linked Business Accounts</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isPrivateContact
              ? "Private contacts cannot be linked to business accounts"
              : "This contact is not currently linked to any clients or suppliers"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {linkedAccounts.map((account) => (
            <Card key={account.id} className="p-4 hover:border-primary transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{account.name}</h4>
                    <div className="flex gap-2 mt-1">
                      <Badge
                        variant={account.partner_type === "customer" ? "default" : "secondary"}
                      >
                        {account.partner_type === "customer" ? "Client" : "Supplier"}
                      </Badge>
                      <Badge variant="outline">
                        {account.entity_type === "business" ? "Business" : "Individual"}
                      </Badge>
                    </div>
                    {account.email && (
                      <p className="text-sm text-muted-foreground mt-2">{account.email}</p>
                    )}
                    {account.phone && (
                      <p className="text-sm text-muted-foreground">{account.phone}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlinkAccount(account.id)}
                  title="Unlink"
                >
                  <Unlink className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
