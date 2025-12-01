"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QrCode, Eye, Copy, Scan, Link as LinkIcon, Trash2, Loader2 } from "lucide-react";
import { LabelAssignmentDialog } from "@/modules/warehouse/components/labels/LabelAssignmentDialog";
import { toast } from "react-toastify";
import { createClient } from "@/lib/supabase/client";

interface LocationQrActionsProps {
  locationId: string;
  locationName: string;
}

interface QRAssignment {
  id: string;
  qr_token: string;
  assigned_at: string;
  assigned_by: string;
}

export function LocationQrActions({
  locationId,
  locationName: _locationName,
}: LocationQrActionsProps) {
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [qrAssignment, setQrAssignment] = useState<QRAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);
  const supabase = createClient();

  // Fetch QR assignment status
  useEffect(() => {
    const fetchQrAssignment = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("qr_labels")
          .select("id, qr_token, assigned_at, assigned_by")
          .eq("entity_type", "location")
          .eq("entity_id", locationId)
          .eq("is_active", true);

        // Use the first result if multiple exist
        const assignment = data && data.length > 0 ? data[0] : null;

        if (error) {
          console.error("Error fetching QR assignment:", error);
        } else if (assignment) {
          setQrAssignment(assignment);
        }
      } catch (error) {
        console.error("Unexpected error fetching QR assignment:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQrAssignment();
  }, [locationId, supabase]);

  const hasAssignedQr = !!qrAssignment;
  const qrToken = qrAssignment?.qr_token || null;

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

  const handleRemoveQr = async () => {
    if (!qrAssignment) return;

    setIsRemoving(true);
    try {
      // Remove assignment from qr_labels
      const { error: qrError } = await supabase
        .from("qr_labels")
        .update({
          entity_type: null,
          entity_id: null,
          assigned_at: null,
          assigned_by: null,
        })
        .eq("id", qrAssignment.id);

      if (qrError) {
        console.error("Error removing QR assignment:", qrError);
        toast.error("Nie udało się usunąć przypisania kodu QR");
        return;
      }

      // Update location record
      const { error: locationError } = await supabase
        .from("locations")
        .update({
          qr_label_id: null,
          has_qr_assigned: false,
          qr_assigned_at: null,
          qr_assigned_by: null,
        })
        .eq("id", locationId);

      if (locationError) {
        console.error("Error updating location:", locationError);
        // Don't show error to user as QR removal was successful
      }

      setQrAssignment(null);
      toast.success("Kod QR został odłączony od lokalizacji");
    } catch (error) {
      console.error("Unexpected error removing QR:", error);
      toast.error("Wystąpił błąd podczas usuwania przypisania");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleAssignmentSuccess = () => {
    // Refresh QR assignment data after successful assignment
    const fetchQrAssignment = async () => {
      try {
        const { data, error } = await supabase
          .from("qr_labels")
          .select("id, qr_token, assigned_at, assigned_by")
          .eq("entity_type", "location")
          .eq("entity_id", locationId)
          .eq("is_active", true);

        const assignment = data && data.length > 0 ? data[0] : null;

        if (!error && assignment) {
          setQrAssignment(assignment);
        }
      } catch (error) {
        console.error("Error refreshing QR assignment:", error);
      }
    };

    fetchQrAssignment();
    setAssignmentDialogOpen(false);
  };

  // Show loading state
  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Ładowanie...
      </Button>
    );
  }

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
          onSuccess={handleAssignmentSuccess}
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
            <DropdownMenuItem
              onClick={handleRemoveQr}
              disabled={isRemoving}
              className="text-destructive"
            >
              {isRemoving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Usuń przypisanie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LabelAssignmentDialog
          open={assignmentDialogOpen}
          onClose={() => setAssignmentDialogOpen(false)}
          onSuccess={handleAssignmentSuccess}
          entityType="location"
          entityId={locationId}
        />
      </>
    );
  }

  return null;
}
