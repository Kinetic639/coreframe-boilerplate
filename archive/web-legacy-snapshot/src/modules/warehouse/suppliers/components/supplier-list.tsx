"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building, Mail, Phone, Globe, MoreHorizontal, Edit, Trash2, Calendar } from "lucide-react";
import { SupplierWithContacts } from "../api";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";

interface SupplierListProps {
  supplier: SupplierWithContacts;
  onEdit?: (supplier: SupplierWithContacts) => void;
  onDelete?: (supplier: SupplierWithContacts) => void;
}

export function SupplierList({ supplier, onEdit, onDelete }: SupplierListProps) {
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: pl,
    });
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-[#10b981] text-white">
              {getInitials(supplier.name)}
            </AvatarFallback>
          </Avatar>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold leading-none">{supplier.name}</h3>
                  {supplier.tags && supplier.tags.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {supplier.tags[0]}
                    </Badge>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {email && (
                    <div className="flex items-center space-x-1">
                      <Mail className="h-4 w-4" />
                      <span className="max-w-[200px] truncate">{email}</span>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center space-x-1">
                      <Phone className="h-4 w-4" />
                      <span>{phone}</span>
                    </div>
                  )}
                  {website && (
                    <div className="flex items-center space-x-1">
                      <Globe className="h-4 w-4" />
                      <span className="max-w-[150px] truncate">{website}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
                  {supplier.created_at && (
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>Dodano {formatDate(supplier.created_at)}</span>
                    </div>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <Building className="mr-1 h-3 w-3" />
                    Aktywny
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/warehouse/suppliers/${supplier.id}`}>
                    Zobacz szczegóły
                  </Link>
                </Button>
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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
