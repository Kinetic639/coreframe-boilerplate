"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Users, Mail, Phone, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Avatar } from "@/components/v2/utility/avatar";
import { SearchForm } from "@/components/v2/forms/search-form";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";

/**
 * Header Contacts Component
 *
 * Contacts drawer that slides from the right
 *
 * Features:
 * - Users icon button
 * - Slide-out drawer from right side
 * - Filter by contact type (private, public, organization, clients, suppliers)
 * - Example contacts with avatars
 * - Search contacts
 * - Contact actions (email, call)
 *
 * TODO: Connect to real contacts system:
 * - Real-time updates via Supabase Realtime
 * - Persist contacts to database
 * - Link to full contacts page
 * - Add/edit/delete functionality
 */

type ContactType = "private" | "public" | "organization" | "clients" | "suppliers";

interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  avatar?: string;
  initials: string;
  status: "online" | "offline" | "away";
  type: ContactType;
}

const EXAMPLE_CONTACTS: Contact[] = [
  // Private contacts
  {
    id: "1",
    name: "John Smith",
    role: "Personal Contact",
    company: "External",
    email: "john.smith@email.com",
    phone: "+1 (555) 111-2222",
    initials: "JS",
    status: "offline",
    type: "private",
  },
  {
    id: "2",
    name: "Alice Cooper",
    role: "Friend",
    company: "Personal",
    email: "alice.c@email.com",
    phone: "+1 (555) 222-3333",
    initials: "AC",
    status: "online",
    type: "private",
  },
  // Public contacts
  {
    id: "3",
    name: "Bob Williams",
    role: "Industry Contact",
    company: "Tech Corp",
    email: "bob.w@techcorp.com",
    phone: "+1 (555) 333-4444",
    initials: "BW",
    status: "online",
    type: "public",
  },
  {
    id: "4",
    name: "Carol Davis",
    role: "Consultant",
    company: "Consulting Group",
    email: "carol.d@consulting.com",
    phone: "+1 (555) 444-5555",
    initials: "CD",
    status: "away",
    type: "public",
  },
  // Organization members
  {
    id: "5",
    name: "Sarah Johnson",
    role: "Warehouse Manager",
    company: "Main Warehouse",
    email: "sarah.j@company.com",
    phone: "+1 (555) 123-4567",
    initials: "SJ",
    status: "online",
    type: "organization",
  },
  {
    id: "6",
    name: "Mike Chen",
    role: "Inventory Specialist",
    company: "East Branch",
    email: "mike.c@company.com",
    phone: "+1 (555) 234-5678",
    initials: "MC",
    status: "online",
    type: "organization",
  },
  {
    id: "7",
    name: "Emma Davis",
    role: "Supply Chain Coordinator",
    company: "Main Warehouse",
    email: "emma.d@company.com",
    phone: "+1 (555) 345-6789",
    initials: "ED",
    status: "away",
    type: "organization",
  },
  {
    id: "8",
    name: "Alex Martinez",
    role: "Operations Director",
    company: "Corporate",
    email: "alex.m@company.com",
    phone: "+1 (555) 456-7890",
    initials: "AM",
    status: "offline",
    type: "organization",
  },
  // Clients
  {
    id: "9",
    name: "David Brown",
    role: "Purchasing Manager",
    company: "Retail Chain Inc.",
    email: "david.b@retailchain.com",
    phone: "+1 (555) 555-6666",
    initials: "DB",
    status: "online",
    type: "clients",
  },
  {
    id: "10",
    name: "Emily Wilson",
    role: "Procurement Lead",
    company: "BigBox Store",
    email: "emily.w@bigbox.com",
    phone: "+1 (555) 666-7777",
    initials: "EW",
    status: "away",
    type: "clients",
  },
  {
    id: "11",
    name: "Frank Moore",
    role: "Supply Manager",
    company: "Metro Distributors",
    email: "frank.m@metro.com",
    phone: "+1 (555) 777-8888",
    initials: "FM",
    status: "online",
    type: "clients",
  },
  // Suppliers
  {
    id: "12",
    name: "Lisa Wong",
    role: "Account Manager",
    company: "Global Supplies Co.",
    email: "lisa.w@globalsupplies.com",
    phone: "+1 (555) 567-8901",
    initials: "LW",
    status: "online",
    type: "suppliers",
  },
  {
    id: "13",
    name: "James Brown",
    role: "Sales Representative",
    company: "Parts Unlimited",
    email: "james.b@partsunlimited.com",
    phone: "+1 (555) 678-9012",
    initials: "JB",
    status: "offline",
    type: "suppliers",
  },
  {
    id: "14",
    name: "Nancy Taylor",
    role: "Business Development",
    company: "Wholesale Direct",
    email: "nancy.t@wholesale.com",
    phone: "+1 (555) 888-9999",
    initials: "NT",
    status: "online",
    type: "suppliers",
  },
];

export function HeaderContacts() {
  const [contacts] = useState(EXAMPLE_CONTACTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ContactType | "all">("all");
  const isLoading = false;

  const typeFilteredContacts =
    filter === "all" ? contacts : contacts.filter((c) => c.type === filter);

  const filteredContacts = typeFilteredContacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" aria-label="Contacts">
          <Users className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Contacts</SheetTitle>
          <SheetDescription>Your team members and business contacts</SheetDescription>
        </SheetHeader>

        {/* Filter Tabs */}
        <div className="mt-4 flex gap-1 border-b pb-2 overflow-x-auto">
          {[
            { value: "all", label: "All" },
            { value: "private", label: "Private" },
            { value: "public", label: "Public" },
            { value: "organization", label: "Organization" },
            { value: "clients", label: "Clients" },
            { value: "suppliers", label: "Suppliers" },
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => setFilter(type.value as ContactType | "all")}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                filter === type.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mt-4">
          <SearchForm
            placeholder="Search contacts..."
            value={searchQuery}
            onSearch={setSearchQuery}
            onClear={() => setSearchQuery("")}
            debounce={300}
          />
        </div>

        <div className="mt-2 space-y-1">
          {isLoading ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No contacts found</p>
            </div>
          ) : (
            <div className="no-scrollbar overflow-y-auto max-h-[calc(100vh-340px)] space-y-2">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="group relative flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="shrink-0">
                    <Avatar
                      src={contact.avatar}
                      alt={contact.name}
                      fallback={contact.initials}
                      size="lg"
                      status={contact.status}
                      shape="circle"
                    />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-none truncate">
                          {contact.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{contact.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{contact.company}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => (window.location.href = `mailto:${contact.email}`)}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Email
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => (window.location.href = `tel:${contact.phone}`)}
                      >
                        <Phone className="h-3 w-3 mr-1" />
                        Call
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" size="sm" className="w-full">
            View All Contacts
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
