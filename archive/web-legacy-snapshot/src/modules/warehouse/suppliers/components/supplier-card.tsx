"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building, Mail, Phone, Globe, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { SupplierWithContacts } from "../api";
import Link from "next/link";

interface SupplierCardProps {
  supplier: SupplierWithContacts;
  onEdit?: (supplier: SupplierWithContacts) => void;
  onDelete?: (supplier: SupplierWithContacts) => void;
}

export function SupplierCard({ supplier, onEdit, onDelete }: SupplierCardProps) {
  const primaryContact = supplier.primary_contact;
  const email = primaryContact?.email;
  const phone = primaryContact?.phone || primaryContact?.mobile;
  const website = supplier.website;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-[#10b981] text-white">
                {getInitials(supplier.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold leading-none">{supplier.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {primaryContact
                  ? `${primaryContact.first_name} ${primaryContact.last_name}`
                  : "Dostawca"}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(supplier)}>
                <Edit className="mr-2 h-4 w-4" />
                Edytuj
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(supplier)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Usuń
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contact Information */}
        <div className="space-y-2">
          {email && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{phone}</span>
            </div>
          )}
          {website && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span className="truncate">{website}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1 pt-2">
          {supplier.tags &&
            supplier.tags.length > 0 &&
            supplier.tags.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          {supplier.is_active && (
            <Badge variant="outline" className="text-xs">
              <Building className="mr-1 h-3 w-3" />
              Aktywny
            </Badge>
          )}
          {!supplier.is_active && (
            <Badge variant="destructive" className="text-xs">
              Nieaktywny
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/dashboard/warehouse/suppliers/${supplier.id}`}>Zobacz szczegóły</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
