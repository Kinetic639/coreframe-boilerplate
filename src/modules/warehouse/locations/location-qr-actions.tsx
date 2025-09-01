"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QrCode, Eye, Copy, Scan, Link as LinkIcon } from "lucide-react";
import { LabelAssignmentDialog } from "@/modules/warehouse/components/labels/LabelAssignmentDialog";
import { toast } from "react-toastify";

interface LocationQrActionsProps {
  locationId: string;
  locationName: string;
}

export function LocationQrActions({
  locationId,
  locationName: _locationName,
}: LocationQrActionsProps) {
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [_assignedQrCode] = useState<string | null>(null);

  // TODO: Replace with actual data from Supabase
  // For now, simulate an assigned QR code
  const hasAssignedQr = false; // This should come from location data
  const qrToken = _assignedQrCode || null; // The actual QR token if assigned

  const handleCopyUrl = (token: string) => {
    const labelHost = process.env.NEXT_PUBLIC_LABEL_HOST || "http://localhost:3000";
    const url = `${labelHost}/qr/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("URL kodu QR został skopiowany do schowka.");
  };

  const handleViewQr = (token: string) => {
    const labelHost = process.env.NEXT_PUBLIC_LABEL_HOST || "http://localhost:3000";
    window.open(`${labelHost}/qr/${token}`, "_blank");
  };

  if (!hasAssignedQr) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setAssignmentDialogOpen(true)}>
          <Scan className="mr-2 h-4 w-4" />
          Przypisz kod QR
        </Button>

        <LabelAssignmentDialog
          open={assignmentDialogOpen}
          onClose={() => setAssignmentDialogOpen(false)}
          entityType="location"
          entityId={locationId}
        />
      </>
    );
  }

  // Location has an assigned QR code
  if (qrToken) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <QrCode className="mr-2 h-4 w-4" />
              Kod QR
              <Badge variant="secondary" className="ml-2 text-xs">
                {qrToken.slice(-6)}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewQr(qrToken)}>
              <Eye className="mr-2 h-4 w-4" />
              Zobacz kod QR
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyUrl(qrToken)}>
              <Copy className="mr-2 h-4 w-4" />
              Kopiuj URL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAssignmentDialogOpen(true)}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Przypisz nowy kod
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LabelAssignmentDialog
          open={assignmentDialogOpen}
          onClose={() => setAssignmentDialogOpen(false)}
          entityType="location"
          entityId={locationId}
        />
      </>
    );
  }

  return null;
}
