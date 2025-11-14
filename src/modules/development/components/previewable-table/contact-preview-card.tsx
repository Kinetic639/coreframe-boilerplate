"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Mail, MessageCircle, Phone, Tags, UserRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { PreviewContact } from "@/modules/development/samples/previewable-table-data";

interface ContactPreviewCardProps {
  contact: PreviewContact;
  onClose: () => void;
}

export function ContactPreviewCard({ contact, onClose }: ContactPreviewCardProps) {
  return (
    <Card className="m-4 flex h-[calc(100%-2rem)] flex-col overflow-hidden border-0 shadow-none">
      <CardHeader className="flex items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="h-5 w-5 text-primary" />
            {contact.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{contact.role}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {contact.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                <Tags className="mr-1 h-3 w-3" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <Separator />
      <ScrollArea className="flex-1">
        <CardContent className="space-y-6 py-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoLine label="Company" value={contact.company} />
            <InfoLine label="Email" value={contact.email} icon={<Mail className="h-3.5 w-3.5" />} />
            <InfoLine
              label="Phone"
              value={contact.phone}
              icon={<Phone className="h-3.5 w-3.5" />}
            />
            <InfoLine
              label="Last interaction"
              value={`${formatDistanceToNow(new Date(contact.lastInteraction), { addSuffix: true })}`}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Notes</h3>
            <p className="rounded-md border bg-muted/40 p-4 text-sm leading-relaxed text-foreground/90">
              {contact.notes}
            </p>
          </section>
        </CardContent>
      </ScrollArea>
      <Separator />
      <CardFooter className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
        <span className="text-xs text-muted-foreground">
          Designed for the contacts module migration.
        </span>
        <div className="flex gap-2">
          <Button variant="outline">
            <MessageCircle className="mr-2 h-4 w-4" />
            Quick note
          </Button>
          <Button onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Close preview
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function InfoLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="font-medium text-foreground/90">{value}</p>
    </div>
  );
}
