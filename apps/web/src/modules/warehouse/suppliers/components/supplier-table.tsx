"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface SupplierTableProps {
  suppliers: SupplierWithContacts[];
  onEdit?: (supplier: SupplierWithContacts) => void;
  onDelete?: (supplier: SupplierWithContacts) => void;
}

export function SupplierTable({ suppliers, onEdit, onDelete }: SupplierTableProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: pl,
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Dostawca</TableHead>
            <TableHead>Kontakt</TableHead>
            <TableHead>Strona www</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dodano</TableHead>
            <TableHead className="w-[100px]">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => {
            const primaryContact = supplier.primary_contact;
            const email = primaryContact?.email;
            const phone = primaryContact?.phone || primaryContact?.mobile;
            const website = supplier.website;

            return (
              <TableRow key={supplier.id}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-[#10b981] text-white">
                        {getInitials(supplier.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{supplier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {primaryContact
                          ? `${primaryContact.first_name} ${primaryContact.last_name}`
                          : "Dostawca"}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {email && (
                      <div className="flex items-center space-x-1 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="max-w-[200px] truncate">{email}</span>
                      </div>
                    )}
                    {phone && (
                      <div className="flex items-center space-x-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{phone}</span>
                      </div>
                    )}
                    {!email && !phone && <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {website ? (
                    <div className="flex items-center space-x-1 text-sm">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span className="max-w-[150px] truncate">{website}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      <Building className="mr-1 h-3 w-3" />
                      Aktywny
                    </Badge>
                    {supplier.tags && supplier.tags.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {supplier.tags[0]}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(supplier.created_at)}
                  </span>
                </TableCell>
                <TableCell>
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
                      <DropdownMenuItem
                        onClick={() => onDelete?.(supplier)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Usuń
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
