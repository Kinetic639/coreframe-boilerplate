"use client";

import { useEffect, useState } from "react";
import { QrCode, Search } from "lucide-react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listQrCodesAction } from "@/app/actions/qr/list";
import { assignQrToTicketAction } from "@/app/actions/qr/assign";
import type { QrCodeWithStatus } from "@/server/services/qr.service";

interface AssignQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketNumber: string;
  onAssigned: (assignment: {
    assignmentId: string;
    qrCodeId: string;
    token: string;
    label: string | null;
    status: string;
  }) => void;
}

export function AssignQrDialog({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
  onAssigned,
}: AssignQrDialogProps) {
  const [codes, setCodes] = useState<QrCodeWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(null);
      return;
    }
    setLoading(true);
    listQrCodesAction().then((result) => {
      if (result.success) {
        // Show only active codes that are either unassigned,
        // or not already assigned to this specific ticket (UUID match).
        setCodes(
          (result as { success: true; data: QrCodeWithStatus[] }).data.filter((c) => {
            if (c.status !== "active") return false;
            if (!c.assignment) return true;
            // Exclude if already linked to this ticket
            return !(
              c.assignment.target_type === "helpdesk.ticket" && c.assignment.target_id === ticketId
            );
          })
        );
      }
      setLoading(false);
    });
  }, [open]);

  const filtered = codes.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.token.toLowerCase().includes(q) || (c.label ?? "").toLowerCase().includes(q);
  });

  const handleAssign = async () => {
    if (!selected) return;
    setAssigning(true);
    try {
      const result = await assignQrToTicketAction({ qrCodeId: selected, ticketId });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      const code = codes.find((c) => c.id === selected);
      toast.success("QR code assigned to ticket.");
      onAssigned({
        assignmentId: (result as { success: true; data: { id: string } }).data.id,
        qrCodeId: selected,
        token: code?.token ?? "",
        label: code?.label ?? null,
        status: "active",
      });
      onOpenChange(false);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign QR Code to {ticketNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by label or token…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search ? "No matching unassigned codes." : "No unassigned QR codes available."}
              </p>
            ) : (
              filtered.map((code) => (
                <button
                  key={code.id}
                  onClick={() => setSelected(code.id === selected ? null : code.id)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selected === code.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <QrCode className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {code.label ?? (
                        <span className="italic text-muted-foreground">Unlabelled</span>
                      )}
                    </p>
                    <p
                      className={`truncate text-xs ${selected === code.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {code.token}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-xs ${selected === code.id ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}
                  >
                    unassigned
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selected || assigning}>
            {assigning ? "Assigning…" : "Assign QR Code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
