"use client";

import { useState } from "react";
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
import { MoreHorizontal, Eye, CheckCircle, Truck, PackageCheck, XCircle } from "lucide-react";
import { TransferStatusBadge } from "./transfer-status-badge";
import { TransferActionsDialog } from "./transfer-actions-dialog";
import type { TransferRequestWithRelations } from "../types/inter-warehouse-transfers";
import { format } from "date-fns";

interface TransferRequestsTableProps {
  transfers: TransferRequestWithRelations[];
  onRefresh?: () => void;
}

type ActionType = "approve" | "ship" | "receive" | "cancel" | null;

export function TransferRequestsTable({ transfers, onRefresh }: TransferRequestsTableProps) {
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequestWithRelations | null>(
    null
  );
  const [actionType, setActionType] = useState<ActionType>(null);

  const handleAction = (transfer: TransferRequestWithRelations, action: ActionType) => {
    setSelectedTransfer(transfer);
    setActionType(action);
  };

  const handleSuccess = () => {
    setSelectedTransfer(null);
    setActionType(null);
    onRefresh?.();
  };

  const canApprove = (status: string) => status === "pending";
  const canShip = (status: string) => status === "approved";
  const canReceive = (status: string) => status === "in_transit";
  const canCancel = (status: string) =>
    ["draft", "pending", "approved", "in_transit"].includes(status);

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transfer requests found. Create one to get started.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer #</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expected Date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell className="font-medium">{transfer.transfer_number}</TableCell>
                <TableCell>{transfer.from_branch?.name}</TableCell>
                <TableCell>{transfer.to_branch?.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{transfer.items.length}</Badge>
                </TableCell>
                <TableCell>
                  {transfer.priority === "urgent" && <Badge variant="destructive">Urgent</Badge>}
                  {transfer.priority === "high" && <Badge>High</Badge>}
                  {transfer.priority === "normal" && <Badge variant="secondary">Normal</Badge>}
                </TableCell>
                <TableCell>
                  <TransferStatusBadge status={transfer.status} />
                </TableCell>
                <TableCell>
                  {transfer.expected_date
                    ? format(new Date(transfer.expected_date), "MMM dd, yyyy")
                    : "-"}
                </TableCell>
                <TableCell>{format(new Date(transfer.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {canApprove(transfer.status) && (
                        <DropdownMenuItem onClick={() => handleAction(transfer, "approve")}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {canShip(transfer.status) && (
                        <DropdownMenuItem onClick={() => handleAction(transfer, "ship")}>
                          <Truck className="mr-2 h-4 w-4" />
                          Ship
                        </DropdownMenuItem>
                      )}
                      {canReceive(transfer.status) && (
                        <DropdownMenuItem onClick={() => handleAction(transfer, "receive")}>
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Receive
                        </DropdownMenuItem>
                      )}
                      {canCancel(transfer.status) && (
                        <DropdownMenuItem
                          onClick={() => handleAction(transfer, "cancel")}
                          className="text-red-600"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedTransfer && actionType && (
        <TransferActionsDialog
          transfer={selectedTransfer}
          action={actionType}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTransfer(null);
              setActionType(null);
            }
          }}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
